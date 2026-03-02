import { and, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { Hono } from "hono";
import { db } from "@db/console/client";
import { apiKeyAuth, qstashAuth } from "../middleware/auth.js";
import { redis } from "@vendor/upstash";
import { resourceKey, RESOURCE_CACHE_TTL } from "../lib/cache.js";
import { replayDeliveries } from "../lib/replay.js";
import type { ProviderName } from "../providers/types.js";
import {
  gwInstallations,
  gwResources,
  gwWebhookDeliveries,
} from "@db/console/schema";

const admin = new Hono();

const startTime = Date.now();

/**
 * GET /admin/health
 *
 * Health check endpoint. Checks Redis and PlanetScale connectivity.
 */
admin.get("/health", async (c) => {
  let redisStatus = "unknown";
  let databaseStatus = "unknown";

  try {
    await redis.ping();
    redisStatus = "connected";
  } catch {
    redisStatus = "error";
  }

  try {
    await db.execute(sql`SELECT 1`);
    databaseStatus = "connected";
  } catch {
    databaseStatus = "error";
  }

  const allHealthy = redisStatus === "connected" && databaseStatus === "connected";

  return c.json(
    {
      status: allHealthy ? "ok" : "degraded",
      redis: redisStatus,
      database: databaseStatus,
      uptime_ms: Date.now() - startTime,
    },
    allHealthy ? 200 : 503,
  );
});

/**
 * POST /admin/cache/rebuild
 *
 * Rebuild Redis cache from PlanetScale (source of truth).
 * Requires X-API-Key authentication.
 */
admin.post("/cache/rebuild", apiKeyAuth, async (c) => {
  const BATCH_SIZE = 500;
  let offset = 0;
  let rebuilt = 0;

  for (;;) {
    const batch = await db
      .select({
        provider: gwInstallations.provider,
        providerResourceId: gwResources.providerResourceId,
        installationId: gwResources.installationId,
        orgId: gwInstallations.orgId,
      })
      .from(gwResources)
      .innerJoin(gwInstallations, eq(gwResources.installationId, gwInstallations.id))
      .where(eq(gwResources.status, "active"))
      .limit(BATCH_SIZE)
      .offset(offset);

    if (batch.length === 0) break;

    const pipeline = redis.pipeline();
    for (const r of batch) {
      const key = resourceKey(r.provider as ProviderName, r.providerResourceId);
      pipeline.hset(key, { connectionId: r.installationId, orgId: r.orgId });
      pipeline.expire(key, RESOURCE_CACHE_TTL);
    }
    await pipeline.exec();

    rebuilt += batch.length;
    if (batch.length < BATCH_SIZE) break;
    offset += BATCH_SIZE;
  }

  return c.json({ status: "rebuilt", count: rebuilt });
});

/**
 * GET /admin/dlq
 *
 * List messages in the webhook DLQ. Requires X-API-Key authentication.
 */
admin.get("/dlq", apiKeyAuth, async (c) => {
  const rawLimit = parseInt(c.req.query("limit") ?? "50", 10);
  const rawOffset = parseInt(c.req.query("offset") ?? "0", 10);
  const limit = Math.min(Math.max(Number.isNaN(rawLimit) ? 50 : rawLimit, 1), 100);
  const offset = Math.max(Number.isNaN(rawOffset) ? 0 : rawOffset, 0);

  const dlqItems = await db
    .select()
    .from(gwWebhookDeliveries)
    .where(eq(gwWebhookDeliveries.status, "dlq"))
    .limit(limit)
    .offset(offset)
    .orderBy(gwWebhookDeliveries.receivedAt);

  return c.json({ items: dlqItems, limit, offset });
});

/**
 * POST /admin/dlq/replay
 *
 * Replay messages from the DLQ. Requires X-API-Key authentication.
 */
admin.post("/dlq/replay", apiKeyAuth, async (c) => {
  let body: { deliveryIds?: string[] };
  try {
    body = await c.req.json<{ deliveryIds?: string[] }>();
  } catch {
    return c.json({ error: "invalid_json" }, 400);
  }

  if (!body.deliveryIds?.length) {
    return c.json({ error: "missing_delivery_ids" }, 400);
  }

  // Fetch only DLQ entries with stored payloads
  const deliveries = await db
    .select()
    .from(gwWebhookDeliveries)
    .where(
      and(
        inArray(gwWebhookDeliveries.deliveryId, body.deliveryIds),
        eq(gwWebhookDeliveries.status, "dlq"),
      ),
    );

  if (deliveries.length === 0) {
    return c.json(
      { error: "no_matching_dlq_entries", requestedIds: body.deliveryIds },
      404,
    );
  }

  const result = await replayDeliveries(deliveries);
  return c.json({ status: "replayed", ...result });
});

/**
 * POST /admin/replay/catchup
 *
 * Replay webhooks that were persisted but never delivered (e.g., during
 * a flag-off period). Drains the backlog by re-triggering the webhook
 * delivery workflow for each un-delivered webhook.
 *
 * Requires X-API-Key authentication.
 */
admin.post("/replay/catchup", apiKeyAuth, async (c) => {
  let body: {
    provider?: string;
    batchSize?: number;
    since?: string;
    until?: string;
  };
  try {
    body = await c.req.json();
  } catch {
    body = {};
  }

  const batchSize = Math.min(Math.max(body.batchSize ?? 50, 1), 200);

  // Build query: status = "received" (persisted but never delivered)
  const conditions: Parameters<typeof and>[0][] = [eq(gwWebhookDeliveries.status, "received")];

  if (body.provider) {
    conditions.push(eq(gwWebhookDeliveries.provider, body.provider));
  }
  if (body.since) {
    conditions.push(gte(gwWebhookDeliveries.receivedAt, body.since));
  }
  if (body.until) {
    conditions.push(lte(gwWebhookDeliveries.receivedAt, body.until));
  }

  const deliveries = await db
    .select()
    .from(gwWebhookDeliveries)
    .where(and(...conditions))
    .orderBy(gwWebhookDeliveries.receivedAt)
    .limit(batchSize);

  if (deliveries.length === 0) {
    return c.json({ status: "empty", message: "No un-delivered webhooks found" });
  }

  const result = await replayDeliveries(deliveries);

  // Report remaining count so caller knows if more batches are needed
  const [remaining] = await db
    .select({ count: sql<number>`count(*)` })
    .from(gwWebhookDeliveries)
    .where(and(...conditions));

  return c.json({
    status: "replayed",
    ...result,
    remaining: remaining?.count ?? 0,
  });
});

/**
 * POST /admin/delivery-status
 *
 * QStash delivery status callback. Called by QStash after delivery attempts.
 */
admin.post("/delivery-status", qstashAuth, async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid_json" }, 400);
  }

  const { messageId, state, deliveryId } =
    body as Record<string, unknown>;

  if (typeof messageId !== "string" || typeof state !== "string") {
    console.warn("[delivery-status] invalid payload", JSON.stringify(body));
    return c.json({ error: "missing_required_fields", required: ["messageId", "state"] }, 400);
  }

  // Log delivery status (QStash callback)
  // Future: update webhook_deliveries table with delivery confirmation
  console.log("[delivery-status]", { messageId, state, deliveryId });

  return c.json({ status: "received" });
});

export { admin };
