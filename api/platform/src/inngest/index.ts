/**
 * Inngest exports for platform application
 *
 * Registered functions:
 * 1. ingestDelivery - Webhook delivery -> transform -> emit event.capture
 * 2. platformEventStore - Event pipeline fast path (store facts + entities)
 * 3. platformEntityGraph - Entity edge resolution via co-occurrence
 * 4. platformEntityEmbed - Entity narrative embed to Pinecone layer="entities"
 * 5. platformNotificationDispatch - High-significance event notifications via Knock
 * 6. platformBackfillOrchestrator - Backfill orchestration (fan-out entity workers)
 * 7. platformEntityWorker - Per-entity-type backfill pagination + dispatch
 * 8. connectionLifecycle - Connection teardown (close gate, revoke, cleanup)
 * 9. healthCheck - 5m cron: probe all active installations
 * 10. tokenRefresh - 5m cron: refresh expiring OAuth tokens
 * 11. deliveryRecovery - 5m cron: sweep stuck webhook deliveries
 */

import { serve } from "inngest/next";
import { inngest } from "./client";
import { connectionLifecycle } from "./functions/connection-lifecycle";
import { deliveryRecovery } from "./functions/delivery-recovery";
import { healthCheck } from "./functions/health-check";
import { ingestDelivery } from "./functions/ingest-delivery";
import { platformBackfillOrchestrator } from "./functions/platform-backfill-orchestrator";
import { platformEntityEmbed } from "./functions/platform-entity-embed";
import { platformEntityGraph } from "./functions/platform-entity-graph";
import { platformEntityWorker } from "./functions/platform-entity-worker";
import { platformEventStore } from "./functions/platform-event-store";
import { platformNotificationDispatch } from "./functions/platform-notification-dispatch";
import { tokenRefresh } from "./functions/token-refresh";

export { inngest };
export {
  ingestDelivery,
  platformEventStore,
  platformEntityGraph,
  platformEntityEmbed,
  platformNotificationDispatch,
  platformBackfillOrchestrator,
  platformEntityWorker,
  connectionLifecycle,
  healthCheck,
  tokenRefresh,
  deliveryRecovery,
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
      platformNotificationDispatch,
      platformBackfillOrchestrator,
      platformEntityWorker,
      connectionLifecycle,
      healthCheck,
      tokenRefresh,
      deliveryRecovery,
    ],
    servePath: "/api/inngest",
  });
}
