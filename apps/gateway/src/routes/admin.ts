import { eq } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { Hono } from "hono";
import { db } from "@db/console/client";
import { apiKeyAuth } from "../middleware/auth";
import { redis } from "@vendor/upstash";
import { resourceKey, RESOURCE_CACHE_TTL } from "../lib/cache";
import type { ProviderName } from "../providers/types";
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
  const activeResources = await db
    .select({
      provider: gwInstallations.provider,
      providerResourceId: gwResources.providerResourceId,
      installationId: gwResources.installationId,
      orgId: gwInstallations.orgId,
    })
    .from(gwResources)
    .innerJoin(gwInstallations, eq(gwResources.installationId, gwInstallations.id))
    .where(eq(gwResources.status, "active"));

  let rebuilt = 0;
  for (const r of activeResources) {
    const key = resourceKey(r.provider as ProviderName, r.providerResourceId);
    const pipeline = redis.pipeline();
    pipeline.hset(key, { connectionId: r.installationId, orgId: r.orgId });
    pipeline.expire(key, RESOURCE_CACHE_TTL);
    await pipeline.exec();
    rebuilt++;
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
  const limit = Math.min(Math.max(Number.isNaN(rawLimit) ? 50 : rawLimit, 1), 1000);
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
 *
 * Phase 9 implementation pending.
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

  return c.json(
    {
      status: "not_yet_implemented",
      message:
        "DLQ replay requires webhook payload storage — planned for audit enhancement",
      requestedIds: body.deliveryIds,
    },
    501,
  );
});

/**
 * POST /admin/delivery-status
 *
 * QStash delivery status callback. Called by QStash after delivery attempts.
 *
 * Phase 9 implementation pending.
 */
admin.post("/delivery-status", async (c) => {
  const body = await c.req.json<{
    messageId?: string;
    state?: string;
    deliveryId?: string;
  }>();

  // Log delivery status (QStash callback)
  // Future: update webhook_deliveries table with delivery confirmation
  console.log("[delivery-status]", body);

  return c.json({ status: "received" });
});

export { admin };
