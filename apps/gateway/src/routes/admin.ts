import { eq } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { Hono } from "hono";
import { db } from "../lib/db";
import { apiKeyAuth } from "../middleware/auth";
import { resourceKey } from "../lib/keys";
import { redis } from "../lib/redis";
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
    await redis.hset(resourceKey(r.provider as ProviderName, r.providerResourceId), {
      connectionId: r.installationId,
      orgId: r.orgId,
    });
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
  const limit = parseInt(c.req.query("limit") ?? "50", 10);
  const offset = parseInt(c.req.query("offset") ?? "0", 10);

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
  const body = await c.req.json<{ deliveryIds?: string[] }>();

  if (!body.deliveryIds?.length) {
    return c.json({ error: "missing_delivery_ids" }, 400);
  }

  return c.json({
    status: "not_yet_implemented",
    message:
      "DLQ replay requires webhook payload storage — planned for audit enhancement",
    requestedIds: body.deliveryIds,
  });
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
