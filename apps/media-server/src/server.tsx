import { Hono } from "hono";
import { logger } from "hono/logger";

import { renderer } from "./client/renderer";
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

app.get("/", renderer, (c) => {
  return c.render(
    <>
      <h1 className="text-3xl font-bold underline">Hello from SSR</h1>
      <div id="root"></div>
    </>,
  );
});

// Mount Inngest handler at /api/inngest
// app.on(
//   ["GET", "PUT", "POST"],
//   "/api/inngest",
//   serve({
//     client: inngest,
//     functions: [
//       handleCreateImage,
//       handleResourceImageSuccess,
//       handleCreateVideo,
//       handleResourceVideoSuccess,
//     ],
//   }),
// );

// Export the fetch handler for Cloudflare Workers
export default app;
