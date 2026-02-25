import { Hono } from "hono";
import { env } from "../env";
import { redis } from "../lib/redis";
import { qstash } from "../lib/qstash";
import { webhookSeenKey, resourceKey } from "../lib/keys";
import { getWebhookSecret } from "../lib/secrets";
import { getProvider } from "../providers";

const webhooks = new Hono();

interface ConnectionInfo {
  connectionId: string;
  orgId: string;
}

/**
 * POST /webhooks/:provider
 *
 * Hot path: receive webhook → verify signature → deduplicate → resolve
 * connection → publish to QStash → return 200.
 *
 * Target latency: < 50ms P99 (1 signature verify + 2 Redis ops + 1 QStash publish)
 */
webhooks.post("/:provider", async (c) => {
  const providerName = c.req.param("provider");

  // Resolve provider — throws 400 for unknown provider
  let provider;
  try {
    provider = getProvider(providerName);
  } catch {
    return c.json({ error: "unknown_provider", provider: providerName }, 400);
  }

  // Read raw body (must be string for HMAC verification)
  const rawBody = await c.req.text();
  const headers = c.req.raw.headers;

  // 1. Verify webhook signature
  const secret = await getWebhookSecret(provider.name);
  const valid = await provider.verifyWebhook(rawBody, headers, secret);
  if (!valid) {
    return c.json({ error: "invalid_signature" }, 401);
  }

  // Parse payload after signature verification
  let payload: unknown;
  try {
    payload = JSON.parse(rawBody) as unknown;
  } catch {
    return c.json({ error: "invalid_json" }, 400);
  }

  // 2. Extract identifiers
  const deliveryId = provider.extractDeliveryId(headers, payload);
  const eventType = provider.extractEventType(headers, payload);
  const resourceId = provider.extractResourceId(payload);

  // 3. Deduplication — set with NX (only if not exists), TTL 24h
  const deduped = await redis.set(
    webhookSeenKey(provider.name, deliveryId),
    "1",
    { nx: true, ex: 86400 },
  );
  if (!deduped) {
    // Key already existed → duplicate delivery
    return c.json({ status: "duplicate", deliveryId }, 200);
  }

  // 4. Resolve connection from resource ID
  let connectionInfo: ConnectionInfo | null = null;
  if (resourceId) {
    const cached = await redis.hgetall<Record<string, string>>(
      resourceKey(provider.name, resourceId),
    );
    if (cached?.connectionId && cached.orgId) {
      connectionInfo = {
        connectionId: cached.connectionId,
        orgId: cached.orgId,
      };
    }
  }

  if (!connectionInfo) {
    // Unresolvable — send to DLQ topic for manual replay
    await qstash.publishToTopic({
      topic: "webhook-dlq",
      body: {
        provider: provider.name,
        deliveryId,
        eventType,
        resourceId,
        payload,
        receivedAt: Date.now(),
      },
    });
    return c.json(
      { status: "unresolvable", deliveryId, reason: "no_connection_found" },
      200,
    );
  }

  // 5. Publish to QStash for durable delivery to Console
  await qstash.publishJSON({
    url: env.CONSOLE_INGRESS_URL,
    body: {
      deliveryId,
      connectionId: connectionInfo.connectionId,
      orgId: connectionInfo.orgId,
      provider: provider.name,
      eventType,
      payload,
      receivedAt: Date.now(),
    },
    retries: 5,
    deduplicationId: `${provider.name}:${deliveryId}`,
    callback: `${env.GATEWAY_BASE_URL}/admin/delivery-status`,
  });

  return c.json({ status: "accepted", deliveryId }, 200);
});

export { webhooks };
