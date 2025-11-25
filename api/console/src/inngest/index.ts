/**
 * Inngest exports for console application
 *
 * Exports Inngest client, workflows, and route context for Next.js integration
 *
 * Phase 1.6: Provider-agnostic workflow architecture
 * - Orchestration layer for routing sync requests
 * - Provider-specific workflows (GitHub, Linear, Notion, etc.)
 * - Generic document processing
 * - Infrastructure provisioning
 */

import { serve } from "inngest/next";
import { inngest } from "./client/client";

// Orchestration workflows (provider-agnostic)
import { sourceConnected } from "./workflow/orchestration/source-connected";
import { sourceSync } from "./workflow/orchestration/source-sync";

// GitHub provider workflows
import { githubSync } from "./workflow/providers/github/sync";
import { githubPushHandler } from "./workflow/providers/github/push-handler";

// Generic document processing workflows
import { processDocuments } from "./workflow/processing/process-documents";
import { deleteDocuments } from "./workflow/processing/delete-documents";
import { extractRelationships } from "./workflow/processing/extract-relationships";

// Infrastructure workflows
import { ensureStore } from "./workflow/infrastructure/ensure-store";

// Backward compatibility - GitHub adapters (deprecated, will be removed)
// TODO: Fix import paths and dependencies before uncommenting
// import {
// 	githubProcessAdapter,
// 	githubDeleteAdapter,
// } from "./workflow/_deprecated/sources/github-adapter";

// Export Inngest client
export { inngest };

// Export orchestration workflows
export { sourceConnected, sourceSync };

// Export GitHub provider workflows
export { githubSync, githubPushHandler };

// Export generic processing workflows
export { processDocuments, deleteDocuments, extractRelationships };

// Export infrastructure workflows
export { ensureStore };

// Backward compatibility exports (deprecated)
// export { githubProcessAdapter, githubDeleteAdapter };

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
 * Generic Processing:
 * 5. processDocuments - Generic document processor (all sources)
 * 6. deleteDocuments - Generic document deleter (all sources)
 * 7. extractRelationships - Generic relationship extractor
 *
 * Infrastructure:
 * 8. ensureStore - Store provisioning (source-agnostic)
 *
 * Backward Compatibility (deprecated):
 * 9. githubProcessAdapter - OLD: GitHub to generic adapter
 * 10. githubDeleteAdapter - OLD: GitHub delete adapter
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

			// Generic processing
			processDocuments,
			deleteDocuments,
			extractRelationships,

			// Infrastructure
			ensureStore,

			// Backward compatibility (deprecated)
			// TODO: Fix and re-enable deprecated adapters
			// githubProcessAdapter,
			// githubDeleteAdapter,
		],
		servePath: "/api/inngest",
	});
}
