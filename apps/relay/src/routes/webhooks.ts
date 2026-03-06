import { Hono } from "hono";
import { and, eq } from "@vendor/db";
import { getQStashClient } from "@vendor/qstash";
import { workflowClient } from "@vendor/upstash-workflow/client";
import { relayBaseUrl, consoleUrl } from "../lib/urls.js";
import { getEnv } from "../env.js";
import { getProvider } from "@repo/console-providers";
import type { ProviderName } from "@repo/console-providers";
import { webhookSeenKey } from "../lib/cache.js";
import { redis } from "@vendor/upstash";
import type { WebhookReceiptPayload, WebhookEnvelope } from "@repo/console-providers";
import { timingSafeStringEqual } from "@repo/console-providers";
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
  const rawProvider = c.req.param("provider");
  const providerDef = getProvider(rawProvider); // returns ProviderDefinition | undefined

  if (!providerDef) {
    return c.json({ error: "unknown_provider", provider: rawProvider }, 400);
  }

  const providerName: ProviderName = providerDef.name;

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
      resourceId?: string | null;
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
      parsedPayload = providerDef.webhook.parsePayload(body.payload);
    } catch {
      return c.json({ error: "invalid_payload" }, 400);
    }

    // Dedup — same Redis SET NX as the standard webhook path.
    // Prevents duplicates from backfill retries and re-runs.
    const dedupResult = await redis.set(
      webhookSeenKey(providerName, body.deliveryId),
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
        provider: providerName,
        deliveryId: body.deliveryId,
        eventType: body.eventType,
        installationId: body.connectionId,
        status: "received",
        payload: JSON.stringify(parsedPayload),
        receivedAt: new Date(body.receivedAt < 1e12 ? body.receivedAt * 1000 : body.receivedAt).toISOString(),
      })
      .onConflictDoNothing();

    // Allow internal services to explicitly hold webhooks for batch replay.
    // When held, the webhook is persisted above but NOT delivered to Console.
    // It stays at status "received" — available for catchup replay later.
    const holdForReplay = c.req.header("X-Backfill-Hold") === "true";
    if (holdForReplay) {
      return c.json({ status: "accepted", deliveryId: body.deliveryId, held: true });
    }

    // Check feature flag — skip console delivery if disabled
    if (!(await isConsoleFanOutEnabled(providerName))) {
      return c.json({ status: "accepted", deliveryId: body.deliveryId, fanOut: false });
    }

    // Publish directly to Console ingress — skip connection resolution (pre-resolved in body)
    const correlationId = c.get("correlationId");
    await getQStashClient().publishJSON({
      url: `${consoleUrl}/api/gateway/ingress`,
      headers: { "X-Correlation-Id": correlationId },
      body: {
        deliveryId: body.deliveryId,
        connectionId: body.connectionId,
        orgId: body.orgId,
        provider: providerName,
        eventType: body.eventType,
        payload: parsedPayload,
        receivedAt: body.receivedAt,
        correlationId,
      } satisfies WebhookEnvelope,
      retries: 5,
    });

    // Update persisted status — QStash accepted, pending Console delivery
    // Best-effort: don't fail the request if status update fails after QStash accepted
    try {
      await db
        .update(gwWebhookDeliveries)
        .set({ status: "enqueued" })
        .where(
          and(
            eq(gwWebhookDeliveries.provider, providerName),
            eq(gwWebhookDeliveries.deliveryId, body.deliveryId),
          ),
        );
    } catch (err) {
      console.error("[webhooks] failed to update delivery status after enqueue", {
        provider: providerName,
        deliveryId: body.deliveryId,
        error: err,
      });
    }

    return c.json({ status: "accepted", deliveryId: body.deliveryId });
  }

  // Read raw body for HMAC verification
  const rawBody = await c.req.text();
  const headers = c.req.raw.headers;

  // Map provider names to their webhook secrets from env
  const webhookSecrets: Partial<Record<ProviderName, string>> = {
    github: env.GITHUB_WEBHOOK_SECRET,
    vercel: env.VERCEL_CLIENT_INTEGRATION_SECRET,
    linear: env.LINEAR_WEBHOOK_SIGNING_SECRET,
    sentry: env.SENTRY_CLIENT_SECRET,
  };

  // Verify webhook signature — reject invalid webhooks immediately
  // No workflow is triggered for invalid requests.
  const secret = webhookSecrets[providerName];
  if (!secret) {
    return c.json({ error: "unknown_provider", provider: providerName }, 400);
  }
  const valid = providerDef.webhook.verifySignature(rawBody, headers, secret);
  if (!valid) {
    return c.json({ error: "invalid_signature" }, 401);
  }

  // Parse + validate payload with provider-specific Zod schema
  let payload;
  try {
    payload = providerDef.webhook.parsePayload(JSON.parse(rawBody));
  } catch {
    return c.json({ error: "invalid_payload" }, 400);
  }

  let deliveryId: string;
  let eventType: string;
  let resourceId: string | null;
  try {
    deliveryId = providerDef.webhook.extractDeliveryId(headers, payload);
    eventType = providerDef.webhook.extractEventType(headers, payload);
    resourceId = providerDef.webhook.extractResourceId(payload);
  } catch {
    return c.json({ error: "extraction_failed", provider: providerName }, 400);
  }

  // Trigger durable workflow — processing happens asynchronously with
  // step-level retry semantics. Provider gets fast 200 ACK.
  const workflowPayload: WebhookReceiptPayload = {
    provider: providerName,
    deliveryId,
    eventType,
    resourceId,
    payload,
    receivedAt: Date.now(),
    correlationId: c.get("correlationId"),
  };

  await workflowClient.trigger({
    url: `${relayBaseUrl}/workflows/webhook-delivery`,
    body: JSON.stringify(workflowPayload),
    headers: { "Content-Type": "application/json" },
  });

  return c.json({ status: "accepted", deliveryId }, 200);
});

export { webhooks };
