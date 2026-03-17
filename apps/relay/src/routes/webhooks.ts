import { db } from "@db/console/client";
import { gatewayWebhookDeliveries } from "@db/console/schema";
import type {
  WebhookEnvelope,
  WebhookReceiptPayload,
} from "@repo/console-providers";
import { and, eq } from "@vendor/db";
import { log } from "@vendor/observability/log/edge";
import { getQStashClient } from "@vendor/qstash";
import { redis } from "@vendor/upstash";
import { workflowClient } from "@vendor/upstash-workflow/client";
import { Hono } from "hono";
import { webhookSeenKey } from "../lib/cache.js";
import { consoleUrl, relayBaseUrl } from "../lib/urls.js";
import type { WebhookVariables } from "../middleware/webhook.js";
import {
  payloadParseAndExtract,
  providerGuard,
  rawBodyCapture,
  serviceAuthBodyValidator,
  serviceAuthDetect,
  signatureVerify,
  webhookHeaderGuard,
} from "../middleware/webhook.js";

const webhooks = new Hono<{ Variables: WebhookVariables }>();

/**
 * POST /webhooks/:provider
 *
 * Middleware chain validates, verifies, and extracts webhook data before the handler runs:
 *
 *   providerGuard          → validate :provider param, attach providerDef
 *   serviceAuthDetect      → check X-API-Key, set isServiceAuth flag
 *   serviceAuthBodyValidator → (service auth only) validate JSON body with Zod
 *   webhookHeaderGuard     → (standard only) validate required provider headers
 *   rawBodyCapture         → (standard only) read raw body for HMAC
 *   signatureVerify        → (standard only) HMAC verification
 *   payloadParseAndExtract → parse payload via provider schema, extract metadata
 *
 * By the time the handler runs, all context variables are populated and validated.
 *
 * Target: < 20ms (1 sig verify + 1 workflow trigger)
 * Invalid webhooks are rejected at the earliest possible middleware layer.
 */
webhooks.post(
  "/:provider",
  providerGuard,
  serviceAuthDetect,
  serviceAuthBodyValidator,
  webhookHeaderGuard,
  rawBodyCapture,
  signatureVerify,
  payloadParseAndExtract,
  async (c) => {
    const providerName = c.get("providerName");
    const deliveryId = c.get("deliveryId");
    const eventType = c.get("eventType");
    const resourceId = c.get("resourceId");
    const parsedPayload = c.get("parsedPayload");
    const isServiceAuth = c.get("isServiceAuth");

    // Enrich the lifecycle log with webhook-specific fields. All subsequent
    // c.set("logFields", ...) calls accumulate into the single structured
    // log entry emitted by the lifecycle middleware on response completion.
    c.set("logFields", {
      deliveryId,
      eventType,
      auth: isServiceAuth ? "service" : "external",
    });

    // ── Service auth path (backfill / internal service) ──
    if (isServiceAuth) {
      const body = c.get("serviceAuthBody");
      if (!body) {
        return c.json({ error: "missing_body" }, 400);
      }

      // Dedup — prevents duplicates from backfill retries and re-runs.
      const dedupResult = await redis.set(
        webhookSeenKey(providerName, deliveryId),
        "1",
        { nx: true, ex: 86_400 }
      );
      if (dedupResult === null) {
        c.set("logFields", { ...c.get("logFields"), duplicate: true });
        return c.json({ status: "duplicate", deliveryId });
      }

      // Persist for long-term replayability
      await db
        .insert(gatewayWebhookDeliveries)
        .values({
          provider: providerName,
          deliveryId,
          eventType,
          installationId: body.connectionId,
          status: "received",
          payload: JSON.stringify(parsedPayload),
          receivedAt: new Date(
            body.receivedAt < 1e12 ? body.receivedAt * 1000 : body.receivedAt
          ).toISOString(),
        })
        .onConflictDoNothing();

      // Allow internal services to explicitly hold webhooks for batch replay.
      const holdForReplay = c.req.header("X-Backfill-Hold") === "true";
      if (holdForReplay) {
        c.set("logFields", { ...c.get("logFields"), held: true });
        return c.json({ status: "accepted", deliveryId, held: true });
      }

      // Publish directly to Console ingress — skip connection resolution (pre-resolved in body)
      const correlationId = c.get("correlationId");
      await getQStashClient().publishJSON({
        url: `${consoleUrl}/api/gateway/ingress`,
        headers: { "X-Correlation-Id": correlationId },
        body: {
          deliveryId,
          connectionId: body.connectionId,
          orgId: body.orgId,
          provider: providerName,
          eventType,
          payload: parsedPayload,
          receivedAt: body.receivedAt,
          correlationId,
        } satisfies WebhookEnvelope,
        retries: 5,
      });

      c.set("logFields", { ...c.get("logFields"), qstashPublished: true });

      // Update persisted status — best-effort after QStash accepted
      try {
        await db
          .update(gatewayWebhookDeliveries)
          .set({ status: "enqueued" })
          .where(
            and(
              eq(gatewayWebhookDeliveries.provider, providerName),
              eq(gatewayWebhookDeliveries.deliveryId, deliveryId)
            )
          );
      } catch (err) {
        log.error("[webhooks] failed to update delivery status after enqueue", {
          provider: providerName,
          deliveryId,
          error: err,
        });
      }

      return c.json({ status: "accepted", deliveryId });
    }

    // ── Standard webhook path (external provider) ──

    // Trigger durable workflow — processing happens asynchronously with
    // step-level retry semantics. Provider gets fast 200 ACK.
    const workflowPayload: WebhookReceiptPayload = {
      provider: providerName,
      deliveryId,
      eventType,
      resourceId,
      payload: parsedPayload,
      receivedAt: Date.now(),
      correlationId: c.get("correlationId"),
    };

    await workflowClient.trigger({
      url: `${relayBaseUrl}/workflows/webhook-delivery`,
      body: JSON.stringify(workflowPayload),
      headers: { "Content-Type": "application/json" },
    });

    c.set("logFields", { ...c.get("logFields"), workflowTriggered: true });

    return c.json({ status: "accepted", deliveryId }, 200);
  }
);

export { webhooks };
