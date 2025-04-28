import { Hono } from "hono";

import apiRouter from "./router/index";

// Create Hono app
const app = new Hono();

// Mount API router
app.route("/", apiRouter);

// Export the fetch handler for Cloudflare Workers
export default app;
