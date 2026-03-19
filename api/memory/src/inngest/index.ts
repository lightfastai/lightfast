/**
 * Inngest exports for memory application
 *
 * Registered functions:
 * 1. ingestDelivery - Webhook delivery -> transform -> emit event.capture
 * 2. memoryEventStore - Event pipeline fast path (store facts + entities)
 * 3. memoryEntityGraph - Entity edge resolution via co-occurrence
 * 4. memoryEntityEmbed - Entity narrative embed to Pinecone layer="entities"
 * 5. memoryNotificationDispatch - High-significance event notifications via Knock
 */

import { serve } from "inngest/next";
import { inngest } from "./client";
import { ingestDelivery } from "./functions/ingest-delivery";
import { memoryEntityEmbed } from "./functions/memory-entity-embed";
import { memoryEntityGraph } from "./functions/memory-entity-graph";
import { memoryEventStore } from "./functions/memory-event-store";
import { memoryNotificationDispatch } from "./functions/memory-notification-dispatch";

export { inngest };
export {
  ingestDelivery,
  memoryEventStore,
  memoryEntityGraph,
  memoryEntityEmbed,
  memoryNotificationDispatch,
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
    ],
    servePath: "/api/inngest",
  });
}
