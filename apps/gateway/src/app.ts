import { Hono } from "hono";
import { admin } from "./routes/admin";
import { connections } from "./routes/connections/index";
import { webhooks } from "./routes/webhooks";
import { workflows } from "./routes/workflows";

const app = new Hono();

// Mount route groups
app.route("/webhooks", webhooks);
app.route("/connections", connections);
app.route("/admin", admin);
app.route("/workflows", workflows);

// Root health check
app.get("/", (c) =>
  c.json({ service: "gateway", version: "1.0.0", status: "ok" }),
);

export { app };
