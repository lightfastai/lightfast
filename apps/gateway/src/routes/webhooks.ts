import { Hono } from "hono";
import { gatewayBaseUrl } from "../lib/base-url";
import { getWebhookSecret } from "../lib/secrets";
import { workflowClient } from "../lib/workflow-client";
import { getProvider } from "../providers";
import type { WebhookReceiptPayload } from "../workflows/types";

const webhooks = new Hono();

/**
 * POST /webhooks/:provider
 *
 * Thin verification layer. Validates provider webhook signature, extracts
 * identifiers, triggers the durable webhook-receipt workflow, returns fast 200.
 *
 * Target: < 20ms (1 sig verify + 1 workflow trigger)
 * Invalid webhooks are rejected immediately — no workflow overhead.
 */
webhooks.post("/:provider", async (c) => {
  const providerName = c.req.param("provider");

  let provider;
  try {
    provider = getProvider(providerName);
  } catch {
    return c.json({ error: "unknown_provider", provider: providerName }, 400);
  }

  // Read raw body for HMAC verification
  const rawBody = await c.req.text();
  const headers = c.req.raw.headers;

  // Verify webhook signature — reject invalid webhooks immediately
  // No workflow is triggered for invalid requests.
  const secret = await getWebhookSecret(provider.name);
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

  const deliveryId = provider.extractDeliveryId(headers, payload);
  const eventType = provider.extractEventType(headers, payload);
  const resourceId = provider.extractResourceId(payload);

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
    url: `${gatewayBaseUrl}/workflows/webhook-receipt`,
    body: workflowPayload,
  });

  return c.json({ status: "accepted", deliveryId }, 200);
});

export { webhooks };
