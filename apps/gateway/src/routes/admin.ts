import { Hono } from "hono";
import { apiKeyAuth } from "../middleware/auth";
import { redis } from "../lib/redis";

const admin = new Hono();

const startTime = Date.now();

/**
 * GET /admin/health
 *
 * Health check endpoint. Checks Redis connectivity.
 */
admin.get("/health", async (c) => {
  let redisStatus = "unknown";

  try {
    await redis.ping();
    redisStatus = "connected";
  } catch {
    redisStatus = "error";
  }

  const allHealthy = redisStatus === "connected";

  return c.json(
    {
      status: allHealthy ? "ok" : "degraded",
      redis: redisStatus,
      uptime_ms: Date.now() - startTime,
    },
    allHealthy ? 200 : 503,
  );
});

/**
 * POST /admin/cache/rebuild
 *
 * Rebuild Redis cache from Console API (PlanetScale source of truth).
 * Requires X-API-Key authentication.
 *
 * Phase 9 implementation pending.
 */
admin.post("/cache/rebuild", apiKeyAuth, (c) =>
  c.json(
    {
      status: "not_implemented",
      message: "Cache rebuild will be implemented in Phase 9",
    },
    501,
  ),
);

/**
 * GET /admin/dlq
 *
 * List messages in the webhook DLQ. Requires X-API-Key authentication.
 *
 * Phase 9 implementation pending.
 */
admin.get("/dlq", apiKeyAuth, (c) =>
  c.json(
    {
      status: "not_implemented",
      message: "DLQ management will be implemented in Phase 9",
    },
    501,
  ),
);

/**
 * POST /admin/dlq/replay
 *
 * Replay messages from the DLQ. Requires X-API-Key authentication.
 *
 * Phase 9 implementation pending.
 */
admin.post("/dlq/replay", apiKeyAuth, (c) =>
  c.json(
    {
      status: "not_implemented",
      message: "DLQ replay will be implemented in Phase 9",
    },
    501,
  ),
);

/**
 * POST /admin/delivery-status
 *
 * QStash delivery status callback. Called by QStash after delivery attempts.
 *
 * Phase 9 implementation pending.
 */
admin.post("/delivery-status", (c) =>
  c.json(
    {
      status: "not_implemented",
      message: "Delivery status callback will be implemented in Phase 9",
    },
    501,
  ),
);

export { admin };
