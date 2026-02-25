import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { admin } from "./routes/admin";
import { webhooks } from "./routes/webhooks";
import { workflows } from "./routes/workflows";
import { version as VERSION } from "../package.json";

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

// Mount route groups
app.route("/webhooks", webhooks);
app.route("/admin", admin);
app.route("/workflows", workflows);

// Root health check
app.get("/", (c) =>
  c.json({ service: "gateway", version: VERSION, status: "ok" }),
);

export { app };
