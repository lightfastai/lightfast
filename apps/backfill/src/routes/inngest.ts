import { serve } from "@vendor/inngest/hono";
import { Hono } from "hono";

import { inngest } from "../inngest/client.js";
import { backfillOrchestrator } from "../workflows/backfill-orchestrator.js";
import { backfillEntityWorker } from "../workflows/entity-worker.js";

const inngestRoute = new Hono();

inngestRoute.on(
  ["GET", "POST", "PUT"],
  "/",
  serve({ client: inngest, functions: [backfillOrchestrator, backfillEntityWorker] }),
);

export { inngestRoute };
