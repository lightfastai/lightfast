import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { admin } from "./routes/admin";
import { webhooks } from "./routes/webhooks";
import { workflows } from "./routes/workflows";
const app = new Hono();

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
app.route("/api/workflows", workflows);

export default app;
