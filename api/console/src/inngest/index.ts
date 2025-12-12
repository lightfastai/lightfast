/**
 * Inngest exports for console application
 *
 * Exports Inngest client, workflows, and route context for Next.js integration
 *
 * New Unified Architecture:
 * - Unified sync orchestration (sync.orchestrator)
 * - No race conditions (step.invoke for critical operations)
 * - Real completion tracking (waitForEvent pattern)
 * - Accurate metrics from actual processing
 * - Currently supports: GitHub (Linear, Vercel coming soon)
 */

import { serve } from "inngest/next";
import { inngest } from "./client/client";

// Orchestration workflows (provider-agnostic)
import { syncOrchestrator } from "./workflow/orchestration/sync-orchestrator";

// Source-specific orchestrators
import { githubSyncOrchestrator } from "./workflow/sources/github-sync-orchestrator";

// GitHub provider workflows
import { githubPushHandler } from "./workflow/providers/github/push-handler";

// Generic document processing workflows
import { processDocuments } from "./workflow/processing/process-documents";
import { deleteDocuments } from "./workflow/processing/delete-documents";
import { filesBatchProcessor } from "./workflow/processing/files-batch-processor";

// Infrastructure workflows
// Note: ensureStore removed - workspace now has embedding config directly
import { recordActivity } from "./workflow/infrastructure/record-activity";

// Neural memory workflows
import { observationCapture, entityExtraction } from "./workflow/neural";

// Export Inngest client
export { inngest };

// Export orchestration workflows
export { syncOrchestrator };

// Export source-specific orchestrators
export { githubSyncOrchestrator };

// Export GitHub provider workflows
export { githubPushHandler };

// Export generic processing workflows
export { processDocuments, deleteDocuments, filesBatchProcessor };

// Export infrastructure workflows
export { recordActivity };

// Export neural memory workflows
export { observationCapture, entityExtraction };

/**
 * Create the route context for Next.js API routes
 *
 * This function should be called in the Inngest API route handler
 * to set up the Inngest server with all registered functions.
 *
 * New Unified Architecture:
 *
 * Orchestration Layer:
 * 1. syncOrchestrator - Unified sync orchestration (all sources, all modes)
 *
 * Source-Specific Orchestrators:
 * 2. githubSyncOrchestrator - GitHub-specific sync logic
 *
 * GitHub Provider:
 * 3. githubPushHandler - Routes GitHub push webhooks to sync.requested
 *
 * Batch Processing (NEW):
 * 4. filesBatchProcessor - Processes file batches with completion tracking
 *
 * Generic Processing:
 * 5. processDocuments - Generic document processor (all sources)
 * 6. deleteDocuments - Generic document deleter (all sources)
 *
 * Infrastructure:
 * 7. recordActivity - Activity logging
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
      // Orchestration layer
      syncOrchestrator, // Unified sync orchestrator

      // Source-specific orchestrators
      githubSyncOrchestrator,

      // GitHub provider
      githubPushHandler,

      // Batch processing (NEW ARCHITECTURE)
      filesBatchProcessor, // Process file batches with completion

      // Generic processing
      processDocuments,
      deleteDocuments,

      // Infrastructure
      recordActivity,

      // Neural memory
      observationCapture,
      entityExtraction,
    ],
    servePath: "/api/inngest",
  });
}
