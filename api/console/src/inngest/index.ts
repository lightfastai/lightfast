/**
 * Inngest exports for console application
 *
 * Exports Inngest client, workflows, and route context for Next.js integration
 *
 * Phase 1.6: Provider-agnostic workflow architecture
 * - Orchestration layer for routing sync requests
 * - Provider-specific workflows (GitHub sync, push handling)
 * - Adapter pattern (GitHub → Generic transformation)
 * - Generic document processing (multi-source)
 * - Infrastructure provisioning (stores, activity logging)
 */

import { serve } from "inngest/next";
import { inngest } from "./client/client";

// Orchestration workflows (provider-agnostic)
import { sourceConnected } from "./workflow/orchestration/source-connected";
import { sourceSync } from "./workflow/orchestration/source-sync";

// GitHub provider workflows
import { githubSync } from "./workflow/providers/github/sync";
import { githubPushHandler } from "./workflow/providers/github/push-handler";

// GitHub adapters (transform GitHub-specific events to generic document events)
import {
  githubProcessAdapter,
  githubDeleteAdapter,
} from "./workflow/adapters/github-adapter";

// Generic document processing workflows
import { processDocuments } from "./workflow/processing/process-documents";
import { deleteDocuments } from "./workflow/processing/delete-documents";
import { extractRelationships } from "./workflow/processing/extract-relationships";

// Infrastructure workflows
import { ensureStore } from "./workflow/infrastructure/ensure-store";
import { recordActivity } from "./workflow/infrastructure/record-activity";

// Export Inngest client
export { inngest };

// Export orchestration workflows
export { sourceConnected, sourceSync };

// Export GitHub provider workflows
export { githubSync, githubPushHandler };

// Export GitHub adapters
export { githubProcessAdapter, githubDeleteAdapter };

// Export generic processing workflows
export { processDocuments, deleteDocuments, extractRelationships };

// Export infrastructure workflows
export { ensureStore, recordActivity };

/**
 * Create the route context for Next.js API routes
 *
 * This function should be called in the Inngest API route handler
 * to set up the Inngest server with all registered functions.
 *
 * Phase 1.6 workflow architecture:
 *
 * Orchestration Layer:
 * 1. sourceConnected - Routes source connection to provider sync
 * 2. sourceSync - Generic sync orchestrator (manual/scheduled/config-change)
 *
 * GitHub Provider:
 * 3. githubPushHandler - Routes GitHub push webhooks to sync
 * 4. githubSync - Handles full/incremental GitHub repository sync
 *
 * GitHub Adapters (Provider → Generic transformation):
 * 5. githubProcessAdapter - Fetches GitHub content → documents.process
 * 6. githubDeleteAdapter - Transforms deletions → documents.delete
 *
 * Generic Processing (Multi-Source):
 * 7. processDocuments - Generic document processor (all sources)
 * 8. deleteDocuments - Generic document deleter (all sources)
 * 9. extractRelationships - Generic relationship extractor
 *
 * Infrastructure:
 * 10. ensureStore - Store provisioning (source-agnostic)
 * 11. recordActivity - Activity logging
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
			sourceConnected,
			sourceSync,

			// GitHub provider
			githubPushHandler,
			githubSync,

			// GitHub adapters (fetch content, transform to generic events)
			githubProcessAdapter,
			githubDeleteAdapter,

			// Generic processing
			processDocuments,
			deleteDocuments,
			extractRelationships,

			// Infrastructure
			ensureStore,
			recordActivity,
		],
		servePath: "/api/inngest",
	});
}
