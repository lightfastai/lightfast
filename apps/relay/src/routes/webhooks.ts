import { Hono } from "hono";
import { and, eq } from "@vendor/db";
import { getQStashClient } from "@vendor/qstash";
import { workflowClient } from "@vendor/upstash-workflow/client";
import { relayBaseUrl, consoleUrl } from "../lib/urls.js";
import { webhookSeenKey } from "../lib/cache.js";
import { redis } from "@vendor/upstash";
import type { WebhookReceiptPayload, WebhookEnvelope } from "@repo/console-providers";
import { db } from "@db/console/client";
import { gwWebhookDeliveries } from "@db/console/schema";
import { isConsoleFanOutEnabled } from "../lib/flags.js";
import type { WebhookVariables } from "../middleware/webhook.js";
import {
  providerGuard,
  serviceAuthDetect,
  serviceAuthBodyValidator,
  webhookHeaderGuard,
  rawBodyCapture,
  signatureVerify,
  payloadParseAndExtract,
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

    // ── Service auth path (backfill / internal service) ──
    if (isServiceAuth) {
      const body = c.get("serviceAuthBody");
      if (!body) return c.json({ error: "missing_body" }, 400);

      // Dedup — prevents duplicates from backfill retries and re-runs.
      const dedupResult = await redis.set(
        webhookSeenKey(providerName, deliveryId),
        "1",
        { nx: true, ex: 86400 },
      );
      if (dedupResult === null) {
        return c.json({ status: "duplicate", deliveryId });
      }

      // Persist for long-term replayability
      await db
        .insert(gwWebhookDeliveries)
        .values({
          provider: providerName,
          deliveryId,
          eventType,
          installationId: body.connectionId,
          status: "received",
          payload: JSON.stringify(parsedPayload),
          receivedAt: new Date(body.receivedAt < 1e12 ? body.receivedAt * 1000 : body.receivedAt).toISOString(),
        })
        .onConflictDoNothing();

      // Allow internal services to explicitly hold webhooks for batch replay.
      const holdForReplay = c.req.header("X-Backfill-Hold") === "true";
      if (holdForReplay) {
        return c.json({ status: "accepted", deliveryId, held: true });
      }

      // Check feature flag — skip console delivery if disabled
      if (!(await isConsoleFanOutEnabled(providerName))) {
        return c.json({ status: "accepted", deliveryId, fanOut: false });
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

      // Update persisted status — best-effort after QStash accepted
      try {
        await db
          .update(gwWebhookDeliveries)
          .set({ status: "enqueued" })
          .where(
            and(
              eq(gwWebhookDeliveries.provider, providerName),
              eq(gwWebhookDeliveries.deliveryId, deliveryId),
            ),
          );
      } catch (err) {
        console.error("[webhooks] failed to update delivery status after enqueue", {
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

    return c.json({ status: "accepted", deliveryId }, 200);
  },
);

export { webhooks };
