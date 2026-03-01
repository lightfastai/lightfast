import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { errorSanitizer } from "./middleware/error-sanitizer.js";
import { logger } from "./middleware/logger.js";
import { requestId } from "./middleware/request-id.js";
import { sentry } from "./middleware/sentry.js";
import { timing } from "./middleware/timing.js";
import { admin } from "./routes/admin.js";
import { backfill } from "./routes/backfill.js";
import { webhooks } from "./routes/webhooks.js";
import { workflows } from "./routes/workflows.js";

const app = new Hono();

// Global middleware (order matters)
app.use(requestId);
app.use(logger);
app.use(sentry);
app.use(errorSanitizer);
app.use(timing);

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
