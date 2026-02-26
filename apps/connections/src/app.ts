import { Hono } from "hono";
import { connections } from "./routes/connections";
import { workflows } from "./routes/workflows";
import { version as VERSION } from "../package.json";

const app = new Hono();

// Mount route groups
app.route("/connections", connections);
app.route("/workflows", workflows);

// Root health check
app.get("/", (c) =>
  c.json({ service: "connections", version: VERSION, status: "ok" }),
);

export { app };
