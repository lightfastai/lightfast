import { Hono } from "hono";
import { getQStashClient } from "@vendor/qstash";
import { getWorkflowClient } from "@vendor/upstash-workflow/client";
import { gatewayBaseUrl, consoleUrl } from "../lib/urls";
import { env } from "../env";
import { getProvider } from "../providers";
import { webhookSeenKey } from "../lib/cache";
import { redis } from "@vendor/upstash";
import type { WebhookReceiptPayload, WebhookEnvelope } from "@repo/gateway-types";
import { timingSafeEqual } from "../lib/crypto";

const qstash = getQStashClient();
const workflowClient = getWorkflowClient();

const webhooks = new Hono();

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

  let provider;
  try {
    provider = getProvider(providerName);
  } catch {
    return c.json({ error: "unknown_provider", provider: providerName }, 400);
  }

  // Service auth path — backfill or other internal service
  // Pre-resolved connectionId/orgId provided in body; skip HMAC/dedup/resolution.
  const apiKey = c.req.header("X-API-Key");
  if (apiKey && timingSafeEqual(apiKey, env.GATEWAY_API_KEY)) {
    const body = await c.req.json<{
      connectionId: string;
      orgId: string;
      deliveryId: string;
      eventType: string;
      payload: unknown;
      receivedAt: number;
    }>();

    if (!body.connectionId || !body.orgId || !body.deliveryId || !body.eventType || !body.payload) {
      return c.json({ error: "missing_required_fields" }, 400);
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

    // Publish directly to Console ingress — skip connection resolution (pre-resolved in body)
    await qstash.publishJSON({
      url: `${consoleUrl}/api/webhooks/ingress`,
      body: {
        deliveryId: body.deliveryId,
        connectionId: body.connectionId,
        orgId: body.orgId,
        provider: provider.name,
        eventType: body.eventType,
        payload: parsedPayload,
        receivedAt: body.receivedAt,
      } satisfies WebhookEnvelope,
      retries: 5,
    });

    return c.json({ status: "accepted", deliveryId: body.deliveryId });
  }

  // Read raw body for HMAC verification
  const rawBody = await c.req.text();
  const headers = c.req.raw.headers;

  // Verify webhook signature — reject invalid webhooks immediately
  // No workflow is triggered for invalid requests.
  const secretMap: Record<string, string | undefined> = {
    github: env.GITHUB_WEBHOOK_SECRET,
    vercel: env.VERCEL_CLIENT_INTEGRATION_SECRET,
    linear: env.LINEAR_WEBHOOK_SIGNING_SECRET,
    sentry: env.SENTRY_CLIENT_SECRET,
  };
  const secret = secretMap[provider.name];
  if (!secret) {
    return c.json({ error: "missing_webhook_secret", provider: provider.name }, 500);
  }
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
  let resourceId: string;
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
  };

  await workflowClient.trigger({
    url: `${gatewayBaseUrl}/workflows/webhook-delivery`,
    body: workflowPayload,
  });

  return c.json({ status: "accepted", deliveryId }, 200);
});

export { webhooks };
