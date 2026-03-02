import { Hono } from "hono";
import { and, eq } from "drizzle-orm";
import { getQStashClient } from "@vendor/qstash";
import { getWorkflowClient } from "@vendor/upstash-workflow/client";
import { relayBaseUrl, consoleUrl } from "../lib/urls.js";
import { getEnv } from "../env.js";
import { getProvider } from "../providers/index.js";
import type { WebhookProvider } from "../providers/index.js";
import { webhookSeenKey } from "../lib/cache.js";
import { redis } from "@vendor/upstash";
import type { WebhookReceiptPayload, WebhookEnvelope } from "@repo/gateway-types";
import { timingSafeStringEqual } from "../lib/crypto.js";
import type { LifecycleVariables } from "../middleware/lifecycle.js";
import { db } from "@db/console/client";
import { gwWebhookDeliveries } from "@db/console/schema";
import { isConsoleFanOutEnabled } from "../lib/flags.js";

const webhooks = new Hono<{ Variables: LifecycleVariables }>();

/**
 * POST /webhooks/:provider
 *
 * Thin verification layer. Validates provider webhook signature, extracts
 * identifiers, triggers the durable webhook-delivery workflow, returns fast 200.
 *
 * Target: < 20ms (1 sig verify + 1 workflow trigger)
 * Invalid webhooks are rejected immediately — no workflow overhead.
 *
 * Service auth bypass: When X-API-Key header is present and valid, the request
 * is from an internal service (e.g. backfill). Skips HMAC verification, dedup,
 * and connection resolution — publishes directly to Console via QStash.
 */
webhooks.post("/:provider", async (c) => {
  const providerName = c.req.param("provider");

  let provider: WebhookProvider;
  try {
    provider = getProvider(providerName);
  } catch {
    return c.json({ error: "unknown_provider", provider: providerName }, 400);
  }

  const env = getEnv(c);

  // Service auth path — backfill or other internal service
  // Pre-resolved connectionId/orgId provided in body; skip HMAC/dedup/resolution.
  const apiKey = c.req.header("X-API-Key");
  if (apiKey && timingSafeStringEqual(apiKey, env.GATEWAY_API_KEY)) {
    let body: {
      connectionId: string;
      orgId: string;
      deliveryId: string;
      eventType: string;
      payload: unknown;
      receivedAt: number;
    };
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "invalid_json" }, 400);
    }

    if (!body.connectionId || !body.orgId || !body.deliveryId || !body.eventType || !body.payload) {
      return c.json({ error: "missing_required_fields" }, 400);
    }

    if (typeof body.receivedAt !== "number" || !Number.isFinite(body.receivedAt)) {
      return c.json({ error: "invalid_field", field: "receivedAt" }, 400);
    }

    // Parse payload through provider schema (validates structure, applies .passthrough())
    let parsedPayload;
    try {
      parsedPayload = provider.parsePayload(body.payload);
    } catch {
      return c.json({ error: "invalid_payload" }, 400);
    }

    // Dedup — same Redis SET NX as the standard webhook path.
    // Prevents duplicates from backfill retries and re-runs.
    const dedupResult = await redis.set(
      webhookSeenKey(provider.name, body.deliveryId),
      "1",
      { nx: true, ex: 86400 },
    );
    if (dedupResult === null) {
      return c.json({ status: "duplicate", deliveryId: body.deliveryId });
    }

    // Persist for long-term replayability
    await db
      .insert(gwWebhookDeliveries)
      .values({
        provider: provider.name,
        deliveryId: body.deliveryId,
        eventType: body.eventType,
        installationId: body.connectionId,
        status: "received",
        payload: JSON.stringify(parsedPayload),
        receivedAt: new Date(body.receivedAt).toISOString(),
      })
      .onConflictDoNothing();

    // Check feature flag — skip console delivery if disabled
    if (!(await isConsoleFanOutEnabled(provider.name))) {
      return c.json({ status: "accepted", deliveryId: body.deliveryId, fanOut: false });
    }

    // Publish directly to Console ingress — skip connection resolution (pre-resolved in body)
    const correlationId = c.get("correlationId");
    await getQStashClient().publishJSON({
      url: `${consoleUrl}/api/webhooks/ingress`,
      headers: { "X-Correlation-Id": correlationId },
      body: {
        deliveryId: body.deliveryId,
        connectionId: body.connectionId,
        orgId: body.orgId,
        provider: provider.name,
        eventType: body.eventType,
        payload: parsedPayload,
        receivedAt: body.receivedAt,
        correlationId,
      } satisfies WebhookEnvelope,
      retries: 5,
    });

    // Update persisted status — QStash accepted the message
    await db
      .update(gwWebhookDeliveries)
      .set({ status: "delivered" })
      .where(
        and(
          eq(gwWebhookDeliveries.provider, provider.name),
          eq(gwWebhookDeliveries.deliveryId, body.deliveryId),
        ),
      );

    return c.json({ status: "accepted", deliveryId: body.deliveryId });
  }

  // Read raw body for HMAC verification
  const rawBody = await c.req.text();
  const headers = c.req.raw.headers;

  // Verify webhook signature — reject invalid webhooks immediately
  // No workflow is triggered for invalid requests.
  const secret = provider.getWebhookSecret(env);
  const valid = await provider.verifyWebhook(rawBody, headers, secret);
  if (!valid) {
    return c.json({ error: "invalid_signature" }, 401);
  }

  // Parse + validate payload with provider-specific Zod schema
  let payload;
  try {
    payload = provider.parsePayload(JSON.parse(rawBody));
  } catch {
    return c.json({ error: "invalid_payload" }, 400);
  }

  let deliveryId: string;
  let eventType: string;
  let resourceId: string | null;
  try {
    deliveryId = provider.extractDeliveryId(headers, payload);
    eventType = provider.extractEventType(headers, payload);
    resourceId = provider.extractResourceId(payload);
  } catch {
    return c.json({ error: "extraction_failed", provider: providerName }, 400);
  }

  // Trigger durable workflow — processing happens asynchronously with
  // step-level retry semantics. Provider gets fast 200 ACK.
  const workflowPayload: WebhookReceiptPayload = {
    provider: provider.name,
    deliveryId,
    eventType,
    resourceId,
    payload,
    receivedAt: Date.now(),
    correlationId: c.get("correlationId"),
  };

  await getWorkflowClient().trigger({
    url: `${relayBaseUrl}/workflows/webhook-delivery`,
    body: workflowPayload,
  });

  return c.json({ status: "accepted", deliveryId }, 200);
});

export { webhooks };
