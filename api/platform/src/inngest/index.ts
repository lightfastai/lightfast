/**
 * Inngest exports for platform application
 *
 * Registered functions:
 * 1. ingestDelivery - Webhook delivery -> transform -> emit event.capture
 * 2. platformEventStore - Event pipeline fast path (store facts + entities)
 * 3. platformEntityGraph - Entity edge resolution via co-occurrence
 * 4. platformEntityEmbed - Entity narrative embed to Pinecone layer="entities"
 * 5. platformBackfillOrchestrator - Backfill orchestration (fan-out entity workers)
 * 6. platformEntityWorker - Per-entity-type backfill pagination + dispatch
 * 7. connectionLifecycle - Connection teardown (close gate, revoke, cleanup)
 * 8. healthCheck - 5m cron: probe all active installations
 * 9. tokenRefresh - 5m cron: refresh expiring OAuth tokens
 * 10. deliveryRecovery - 5m cron: sweep stuck webhook deliveries
 * 11. platformRepoIndexSync - Syncs indexed repo content (README.md) on push events
 * 12. platformAgentTriage - Loads .lightfast config and runs a triage LLM call on stored events
 */

import { serve } from "inngest/next";
import { inngest } from "./client";
import { connectionLifecycle } from "./functions/connection-lifecycle";
import { deliveryRecovery } from "./functions/delivery-recovery";
import { healthCheck } from "./functions/health-check";
import { ingestDelivery } from "./functions/ingest-delivery";
import { platformAgentTriage } from "./functions/platform-agent-triage";
import { platformBackfillOrchestrator } from "./functions/platform-backfill-orchestrator";
import { platformEntityEmbed } from "./functions/platform-entity-embed";
import { platformEntityGraph } from "./functions/platform-entity-graph";
import { platformEntityWorker } from "./functions/platform-entity-worker";
import { platformEventStore } from "./functions/platform-event-store";
import { platformRepoIndexSync } from "./functions/platform-repo-index-sync";
import { tokenRefresh } from "./functions/token-refresh";

export { inngest };
export {
  ingestDelivery,
  platformEventStore,
  platformEntityGraph,
  platformEntityEmbed,
  platformBackfillOrchestrator,
  platformEntityWorker,
  connectionLifecycle,
  healthCheck,
  tokenRefresh,
  deliveryRecovery,
  platformRepoIndexSync,
  platformAgentTriage,
};

/**
 * Create the Inngest route handler for Next.js
 */
export function createInngestRouteContext() {
  return serve({
    client: inngest,
    functions: [
      ingestDelivery,
      platformEventStore,
      platformEntityGraph,
      platformEntityEmbed,
      platformBackfillOrchestrator,
      platformEntityWorker,
      connectionLifecycle,
      healthCheck,
      tokenRefresh,
      deliveryRecovery,
      platformRepoIndexSync,
      platformAgentTriage,
    ],
    servePath: "/api/inngest",
  });
}
