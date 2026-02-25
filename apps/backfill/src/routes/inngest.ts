import { Hono } from "hono";
import { serve } from "@vendor/inngest/hono";
import { inngest } from "../inngest/client";
import { backfillOrchestrator } from "../workflows/backfill-orchestrator";
import { backfillEntityWorker } from "../workflows/entity-worker";

const inngestRoute = new Hono();

inngestRoute.on(
  ["GET", "POST", "PUT"],
  "/",
  serve({ client: inngest, functions: [backfillOrchestrator, backfillEntityWorker] }),
);

export { inngestRoute };
