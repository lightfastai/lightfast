import "./sentry-init.js";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { errorSanitizer } from "./middleware/error-sanitizer.js";
import type { LifecycleVariables } from "./middleware/lifecycle.js";
import { lifecycle } from "./middleware/lifecycle.js";
import { requestId } from "./middleware/request-id.js";
import { sentry } from "./middleware/sentry.js";
import { inngestRoute } from "./routes/inngest.js";
import { trigger } from "./routes/trigger.js";

const app = new Hono<{ Variables: LifecycleVariables }>();

/**
 * Global middleware (order matters)
 *
 * 1. requestId      — assign/propagate unique ID + cross-service correlationId
 * 2. lifecycle      — structured JSON log per request + dev artificial delay
 * 3. errorSanitizer — strip 5xx details before reaching the client
 * 4. sentry         — capture exceptions AND 5xx responses (before sanitization)
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

  console.error("[backfill] unhandled error", {
    method: c.req.method,
    path: c.req.path,
    error: err.message,
    stack: err.stack,
  });

  return c.json({ error: "internal_server_error" }, 500);
});

// Health check
app.get("/", (c) => c.json({ service: "backfill", status: "ok" }));

// API routes
app.route("/api/trigger", trigger);
app.route("/api/inngest", inngestRoute);

export default app;
