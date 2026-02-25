import { Hono } from "hono";
import { trigger } from "./routes/trigger";
import { inngestRoute } from "./routes/inngest";

const app = new Hono();

app.route("/trigger", trigger);
app.route("/inngest", inngestRoute);

app.get("/", (c) =>
  c.json({ service: "backfill", version: "1.0.0", status: "ok" }),
);

export { app };
