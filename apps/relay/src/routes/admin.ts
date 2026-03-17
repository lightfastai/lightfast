import { db } from "@db/console/client";
import {
  gatewayBackfillRuns,
  gatewayInstallations,
  gatewayResources,
  gatewayWebhookDeliveries,
} from "@db/console/schema";
import type { SourceType } from "@repo/console-providers";
import { and, eq, gte, lte, notInArray, or, sql } from "@vendor/db";
import { redis } from "@vendor/upstash";
import { Hono } from "hono";
import { z } from "zod";
import { env } from "../env.js";
import { RESOURCE_CACHE_TTL, resourceKey } from "../lib/cache.js";
import { replayDeliveries } from "../lib/replay.js";
import { apiKeyAuth, qstashAuth } from "../middleware/auth.js";
import type { LifecycleVariables } from "../middleware/lifecycle.js";

const admin = new Hono<{ Variables: LifecycleVariables }>();

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

  const allHealthy =
    redisStatus === "connected" && databaseStatus === "connected";

  return c.json(
    {
      status: allHealthy ? "ok" : "degraded",
      redis: redisStatus,
      database: databaseStatus,
      uptime_ms: Date.now() - startTime,
    },
    allHealthy ? 200 : 503
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
        provider: gatewayInstallations.provider,
        providerResourceId: gatewayResources.providerResourceId,
        installationId: gatewayResources.installationId,
        orgId: gatewayInstallations.orgId,
      })
      .from(gatewayResources)
      .innerJoin(
        gatewayInstallations,
        eq(gatewayResources.installationId, gatewayInstallations.id)
      )
      .where(eq(gatewayResources.status, "active"))
      .limit(BATCH_SIZE)
      .offset(offset);

    if (batch.length === 0) {
      break;
    }

    const pipeline = redis.pipeline();
    for (const r of batch) {
      const key = resourceKey(r.provider as SourceType, r.providerResourceId);
      pipeline.hset(key, { connectionId: r.installationId, orgId: r.orgId });
      pipeline.expire(key, RESOURCE_CACHE_TTL);
    }
    await pipeline.exec();

    rebuilt += batch.length;
    if (batch.length < BATCH_SIZE) {
      break;
    }
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
  const rawLimit = Number.parseInt(c.req.query("limit") ?? "50", 10);
  const rawOffset = Number.parseInt(c.req.query("offset") ?? "0", 10);
  const limit = Math.min(
    Math.max(Number.isNaN(rawLimit) ? 50 : rawLimit, 1),
    100
  );
  const offset = Math.max(Number.isNaN(rawOffset) ? 0 : rawOffset, 0);

  const dlqItems = await db
    .select()
    .from(gatewayWebhookDeliveries)
    .where(eq(gatewayWebhookDeliveries.status, "dlq"))
    .limit(limit)
    .offset(offset)
    .orderBy(gatewayWebhookDeliveries.receivedAt);

  return c.json({ items: dlqItems, limit, offset });
});

/**
 * POST /admin/dlq/replay
 *
 * Replay messages from the DLQ. Requires X-API-Key authentication.
 */
admin.post("/dlq/replay", apiKeyAuth, async (c) => {
  let body: { deliveryIds?: { provider: string; deliveryId: string }[] };
  try {
    body = await c.req.json<typeof body>();
  } catch {
    return c.json({ error: "invalid_json" }, 400);
  }

  if (!body.deliveryIds?.length) {
    return c.json({ error: "missing_delivery_ids" }, 400);
  }

  // Build compound (provider, deliveryId) filter — prevents cross-provider collisions
  const pairConditions = body.deliveryIds.map((item) =>
    and(
      eq(gatewayWebhookDeliveries.provider, item.provider),
      eq(gatewayWebhookDeliveries.deliveryId, item.deliveryId)
    )
  );

  // Fetch only DLQ entries with stored payloads
  const deliveries = await db
    .select()
    .from(gatewayWebhookDeliveries)
    .where(
      and(or(...pairConditions), eq(gatewayWebhookDeliveries.status, "dlq"))
    );

  if (deliveries.length === 0) {
    return c.json(
      { error: "no_matching_dlq_entries", requestedIds: body.deliveryIds },
      404
    );
  }

  const result = await replayDeliveries(deliveries);
  return c.json({ status: "replayed", ...result });
});

const catchupSchema = z.object({
  installationId: z.string().min(1),
  batchSize: z
    .number()
    .int()
    .transform((n) => Math.min(Math.max(n, 1), 200))
    .default(50),
  provider: z.string().optional(),
  since: z.string().optional(),
  until: z.string().optional(),
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
  let raw: unknown;
  try {
    raw = await c.req.json();
  } catch {
    return c.json({ error: "invalid_json" }, 400);
  }

  const parsed = catchupSchema.safeParse(raw);
  if (!parsed.success) {
    return c.json(
      { error: "validation_error", details: parsed.error.issues },
      400
    );
  }
  const body = parsed.data;

  const batchSize = body.batchSize;

  // Build query: status = "received" (persisted but never delivered)
  const conditions: Parameters<typeof and>[0][] = [
    eq(gatewayWebhookDeliveries.status, "received"),
  ];

  conditions.push(
    eq(gatewayWebhookDeliveries.installationId, body.installationId)
  );

  if (body.provider) {
    conditions.push(eq(gatewayWebhookDeliveries.provider, body.provider));
  }
  if (body.since) {
    conditions.push(gte(gatewayWebhookDeliveries.receivedAt, body.since));
  }
  if (body.until) {
    conditions.push(lte(gatewayWebhookDeliveries.receivedAt, body.until));
  }

  const deliveries = await db
    .select()
    .from(gatewayWebhookDeliveries)
    .where(and(...conditions))
    .orderBy(gatewayWebhookDeliveries.receivedAt)
    .limit(batchSize);

  if (deliveries.length === 0) {
    return c.json({
      status: "empty",
      message: "No un-delivered webhooks found",
    });
  }

  const result = await replayDeliveries(deliveries);

  // Exclude just-replayed rows from remaining count
  const replayedIds = deliveries.map((d) => d.id);
  const [remaining] = await db
    .select({ count: sql<number>`count(*)` })
    .from(gatewayWebhookDeliveries)
    .where(
      and(...conditions, notInArray(gatewayWebhookDeliveries.id, replayedIds))
    );

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

  const { messageId, state, deliveryId } = body as Record<string, unknown>;

  if (typeof messageId !== "string" || typeof state !== "string") {
    c.set("logFields", {
      ...c.get("logFields"),
      validationError: "missing_required_fields",
    });
    return c.json(
      { error: "missing_required_fields", required: ["messageId", "state"] },
      400
    );
  }

  c.set("logFields", { ...c.get("logFields"), messageId, state, deliveryId });

  // Update webhook delivery status based on QStash callback
  if (typeof deliveryId === "string") {
    const newStatus =
      state === "delivered" ? "delivered" : state === "error" ? "dlq" : null;
    if (newStatus) {
      const provider = c.req.query("provider");
      const conditions = [eq(gatewayWebhookDeliveries.deliveryId, deliveryId)];
      if (provider) {
        conditions.push(eq(gatewayWebhookDeliveries.provider, provider));
      }
      await db
        .update(gatewayWebhookDeliveries)
        .set({ status: newStatus })
        .where(and(...conditions));
    }
  }

  return c.json({ status: "received" });
});

/**
 * POST /admin/dev/flush-dedup
 *
 * Dev-only: delete all webhook dedup Redis keys (gw:webhook:seen:*).
 * Allows re-testing backfill flows without waiting 24h for TTL expiry.
 */
if (env.NODE_ENV !== "production") {
  admin.post("/dev/flush-dedup", apiKeyAuth, async (c) => {
    const keys = await redis.keys("gw:webhook:seen:*");
    if (keys.length > 0) {
      await redis.del(...keys);
    }
    return c.json({ flushed: keys.length });
  });

  /**
   * DELETE /admin/dev/backfill-runs/:installationId
   *
   * Dev-only: clear all backfill run history for an installation.
   * Allows re-testing by bypassing the gap-aware filter in the orchestrator.
   */
  admin.delete("/dev/backfill-runs/:installationId", apiKeyAuth, async (c) => {
    const installationId = c.req.param("installationId");
    await db
      .delete(gatewayBackfillRuns)
      .where(eq(gatewayBackfillRuns.installationId, installationId));
    return c.json({ cleared: true, installationId });
  });
}

export { admin };
