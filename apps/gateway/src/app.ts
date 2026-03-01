import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { errorSanitizer } from "./middleware/error-sanitizer.js";
import type { LifecycleVariables } from "./middleware/lifecycle.js";
import { lifecycle } from "./middleware/lifecycle.js";
import { requestId } from "./middleware/request-id.js";
import { sentry } from "./middleware/sentry.js";
import { admin } from "./routes/admin.js";
import { backfill } from "./routes/backfill.js";
import { webhooks } from "./routes/webhooks.js";
import { workflows } from "./routes/workflows.js";

const app = new Hono<{ Variables: LifecycleVariables }>();

/**
 * Global middleware (order matters)
 *
 * 1. requestId   — assign/propagate unique ID for downstream correlation
 * 2. lifecycle   — structured JSON log per request + dev artificial delay
 * 3. errorSanitizer — strip 5xx details before reaching the client
 * 4. sentry      — capture exceptions AND 5xx responses (before sanitization)
 *
 * ROADMAP — Future middleware additions:
 *
 * Provider-Aware Rate Limiting:
 *   Sliding-window rate limiter per provider using Redis (gw:ratelimit:{provider}:{window}).
 *   Provider-specific limits (GitHub 500/min, Linear 100/min, etc.).
 *   Returns 429 + Retry-After header. Includes backpressure signaling — when
 *   workflow queue depth exceeds threshold, returns 503 to all providers.
 *   Uses existing Redis infra and provider map.
 *
 * Webhook Health Scoring with Proactive Alerting:
 *   Rolling per-provider health counters in Redis (sig_ok, sig_fail, parse_fail,
 *   delivered, dlq) with 5-minute sliding windows. Computes health score per
 *   provider. Exposed via GET /admin/health/providers. When score drops below
 *   threshold, publishes alert via QStash. Detects secret rotation issues,
 *   schema changes, and delivery failures before users notice missing data.
 */
app.use(requestId);
app.use(lifecycle);
app.use(errorSanitizer);
app.use(sentry);

// Global error handler — catches unhandled exceptions from all routes
app.onError((err, c) => {
  if (err instanceof HTTPException) {
    return err.getResponse();
  }

  console.error("[gateway] unhandled error", {
    method: c.req.method,
    path: c.req.path,
    error: err.message,
    stack: err.stack,
  });

  return c.json({ error: "internal_server_error" }, 500);
});

// Health check
app.get("/", (c) => c.json({ service: "gateway", status: "ok" }));

// API routes
app.route("/api/webhooks", webhooks);
app.route("/api/admin", admin);
app.route("/api/backfill", backfill);
app.route("/api/workflows", workflows);

export default app;
