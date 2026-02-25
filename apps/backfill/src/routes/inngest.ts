import { Hono } from "hono";
import { serve } from "inngest/hono";
import { inngest } from "../inngest/client";
import { backfillOrchestrator } from "../workflows/backfill-orchestrator";

const inngestRoute = new Hono();

inngestRoute.on(
  ["GET", "POST", "PUT"],
  "/",
  serve({ client: inngest, functions: [backfillOrchestrator] }),
);

export { inngestRoute };
