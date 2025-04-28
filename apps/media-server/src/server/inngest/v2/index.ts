import { serve } from "inngest/hono";

import { inngest } from "./client";
import { helloWorld } from "./functions";

// Export the Inngest client
export { inngest } from "./client";
export { helloWorldEvent } from "./functions";

// Export a handler for Inngest functions
export const inngestHandler = serve({
  client: inngest,
  functions: [helloWorld],
  // Use in-memory storage to avoid file system operations in Cloudflare Workers
  serveHost: process.env.INNGEST_SERVE_HOST,
  servePath: "/api/inngest",
});
