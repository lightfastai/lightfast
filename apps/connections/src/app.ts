import { Hono } from "hono";
import { connections } from "./routes/connections.js";
import { workflows } from "./routes/workflows.js";
const app = new Hono();

// Health check
app.get("/", (c) => c.json({ service: "connections", status: "ok" }));

// API routes
app.route("/services/connections", connections);
app.route("/services/connections/workflows", workflows);

export default app;
