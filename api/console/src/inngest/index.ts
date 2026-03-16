/**
 * Inngest exports for console application
 */

import { serve } from "inngest/next";
import { inngest } from "./client/client";
import { recordActivity } from "./workflow/infrastructure/record-activity";
import { entityEmbed, entityGraph, eventStore } from "./workflow/neural";
import { notificationDispatch } from "./workflow/notifications";

export { inngest };
export { recordActivity };
export { entityEmbed, entityGraph, eventStore };
export { notificationDispatch };

/**
 * Create the route context for Next.js API routes
 *
 * Registered functions:
 * 1. recordActivity - Activity logging
 * 2. eventStore - Event pipeline fast path (store facts + entities)
 * 3. entityGraph - Entity edge resolution via co-occurrence
 * 4. entityEmbed - Entity narrative embed to Pinecone layer="entities"
 * 5. notificationDispatch - High-significance event notifications via Knock
 */
export function createInngestRouteContext() {
  return serve({
    client: inngest,
    functions: [
      recordActivity,
      eventStore,
      entityGraph,
      entityEmbed,
      notificationDispatch,
    ],
    servePath: "/api/inngest",
  });
}
