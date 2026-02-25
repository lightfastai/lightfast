import { Hono } from "hono";

const app = new Hono();

app.get("/", (c) => c.json({ service: "gateway", status: "ok" }));

export default app;
