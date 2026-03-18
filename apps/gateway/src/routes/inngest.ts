import { serve } from "@vendor/inngest/hono";
import { Hono } from "hono";

import { healthCheck } from "../functions/health-check.js";
import { tokenRefresh } from "../functions/token-refresh.js";
import { inngest } from "../inngest/client.js";

const inngestRoute = new Hono();

inngestRoute.on(
  ["GET", "POST", "PUT"],
  "/",
  serve({
    client: inngest,
    functions: [healthCheck, tokenRefresh],
  })
);

export { inngestRoute };
