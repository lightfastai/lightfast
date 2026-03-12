/**
 * Inngest exports for console application
 *
 * Exports Inngest client, workflows, and route context for Next.js integration
 */

import { serve } from "inngest/next";
import { inngest } from "./client/client";
// Infrastructure workflows
// Note: ensureStore removed - workspace now has embedding config directly
import { recordActivity } from "./workflow/infrastructure/record-activity";
// Event pipeline workflows
import { eventInterpret, eventStore } from "./workflow/neural";
// Notification workflows
import { notificationDispatch } from "./workflow/notifications";
import { deleteDocuments } from "./workflow/processing/delete-documents";
// Generic document processing workflows
import { processDocuments } from "./workflow/processing/process-documents";

// Export Inngest client
export { inngest };

// Export generic processing workflows
export { processDocuments, deleteDocuments };

// Export infrastructure workflows
export { recordActivity };

// Export event pipeline workflows
export { eventInterpret, eventStore };

// Export notification workflows
export { notificationDispatch };

/**
 * Create the route context for Next.js API routes
 *
 * This function should be called in the Inngest API route handler
 * to set up the Inngest server with all registered functions.
 *
 * Registered functions:
 * 1. processDocuments - Generic document processor (all sources)
 * 2. deleteDocuments - Generic document deleter (all sources)
 * 3. recordActivity - Activity logging
 * 4. eventStore - Event pipeline fast path (store facts + entities)
 * 5. eventInterpret - Event pipeline slow path (classify + embed)
 * 6. notificationDispatch - User-facing notifications
 *
 * @example
 * ```typescript
 * // apps/console/src/app/(inngest)/api/inngest/route.ts
 * import { createInngestRouteContext } from "@api/console/inngest";
 *
 * const handlers = createInngestRouteContext();
 * export const GET = handlers.GET;
 * export const POST = handlers.POST;
 * export const PUT = handlers.PUT;
 * ```
 */
export function createInngestRouteContext() {
  return serve({
    client: inngest,
    functions: [
      // Generic processing
      processDocuments,
      deleteDocuments,

      // Infrastructure
      recordActivity,

      // Event pipeline (fast path + slow path)
      eventStore,
      eventInterpret,

      // Notifications
      notificationDispatch,
    ],
    servePath: "/api/inngest",
  });
}
