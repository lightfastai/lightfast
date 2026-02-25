import { Hono } from "hono";
import { admin } from "./routes/admin";
import { connections } from "./routes/connections";
import { webhooks } from "./routes/webhooks";

const app = new Hono();

// Mount route groups
app.route("/webhooks", webhooks);
app.route("/connections", connections);
app.route("/admin", admin);

// Root health check
app.get("/", (c) =>
  c.json({ service: "gateway", version: "1.0.0", status: "ok" }),
);

export { app };
