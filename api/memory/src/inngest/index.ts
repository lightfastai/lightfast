/**
 * Inngest exports for memory application
 *
 * Functions will be added as they are ported from:
 * - api/console/src/inngest/workflow/neural/ (event-store, entity-graph, entity-embed)
 * - api/console/src/inngest/workflow/notifications/ (dispatch)
 * - apps/backfill/src/workflows/ (orchestrator, entity-worker)
 * - apps/gateway/src/functions/ (health-check, token-refresh)
 */

import { serve } from "inngest/next";
import { inngest } from "./client";

export { inngest };

/**
 * Create the Inngest route handler for Next.js
 *
 * Initially serves zero functions. As functions are ported,
 * they are added to the functions array here.
 */
export function createInngestRouteContext() {
  return serve({
    client: inngest,
    functions: [],
    servePath: "/api/inngest",
  });
}
