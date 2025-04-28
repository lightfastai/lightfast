import { Hono } from "hono";
import { logger } from "hono/logger";

import { serve } from "@vendor/inngest/hono";

// Inngest imports
import { inngest } from "./inngest/client/client";
import { handleCreateImage } from "./inngest/workflow/handle-create-image";
import { handleResourceImageSuccess } from "./inngest/workflow/handle-create-image-success";
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
app.route("/api", apiRouter);

// Mount Inngest handler at /api/inngest
app.on(
  ["GET", "PUT", "POST"],
  "/api/inngest",
  serve({
    client: inngest,
    functions: [handleCreateImage, handleResourceImageSuccess],
  }),
);

// Export the fetch handler for Cloudflare Workers
export default app;
