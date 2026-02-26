import { Hono } from "hono";
import { trigger } from "./routes/trigger.js";
import { inngestRoute } from "./routes/inngest.js";

const app = new Hono();

// Health check
app.get("/", (c) => c.json({ service: "backfill", status: "ok" }));

// API routes
app.route("/api/trigger", trigger);
app.route("/api/inngest", inngestRoute);

export { app };
