import { Hono } from "hono";
import { logger } from "hono/logger";

import apiRouter from "./router/index";

// Create Hono app
const app = new Hono();

// Add logger middleware
app.use("*", logger());

// Add error handling
app.onError((err, c) => {
  console.error("Server error:", err);
  return c.json({ error: err.message }, 500);
});

// Mount API router
app.route("/", apiRouter);

// Export the fetch handler for Cloudflare Workers
export default app;
