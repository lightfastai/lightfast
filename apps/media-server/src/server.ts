import { serve } from "@hono/node-server";
import { Hono } from "hono";

import { env } from "./env.js";
import apiRouter from "./router/index.js";

// Create Hono app
const app = new Hono();

// Mount API router
app.route("/api", apiRouter);

// Serve the application
serve({
  fetch: app.fetch,
  port: env.PORT,
});

// Log startup
console.log(`Media server running on port ${env.PORT}`);
