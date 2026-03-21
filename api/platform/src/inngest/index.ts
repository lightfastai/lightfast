/**
 * Inngest exports for memory application
 *
 * Registered functions:
 * 1. ingestDelivery - Webhook delivery -> transform -> emit event.capture
 * 2. memoryEventStore - Event pipeline fast path (store facts + entities)
 * 3. memoryEntityGraph - Entity edge resolution via co-occurrence
 * 4. memoryEntityEmbed - Entity narrative embed to Pinecone layer="entities"
 * 5. memoryNotificationDispatch - High-significance event notifications via Knock
 * 6. memoryBackfillOrchestrator - Backfill orchestration (fan-out entity workers)
 * 7. memoryEntityWorker - Per-entity-type backfill pagination + dispatch
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
import { memoryBackfillOrchestrator } from "./functions/memory-backfill-orchestrator";
import { memoryEntityEmbed } from "./functions/memory-entity-embed";
import { memoryEntityGraph } from "./functions/memory-entity-graph";
import { memoryEntityWorker } from "./functions/memory-entity-worker";
import { memoryEventStore } from "./functions/memory-event-store";
import { memoryNotificationDispatch } from "./functions/memory-notification-dispatch";
import { tokenRefresh } from "./functions/token-refresh";

export { inngest };
export {
  ingestDelivery,
  memoryEventStore,
  memoryEntityGraph,
  memoryEntityEmbed,
  memoryNotificationDispatch,
  memoryBackfillOrchestrator,
  memoryEntityWorker,
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
      memoryEventStore,
      memoryEntityGraph,
      memoryEntityEmbed,
      memoryNotificationDispatch,
      memoryBackfillOrchestrator,
      memoryEntityWorker,
      connectionLifecycle,
      healthCheck,
      tokenRefresh,
      deliveryRecovery,
    ],
    servePath: "/api/inngest",
  });
}
