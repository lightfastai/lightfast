/**
 * Inngest exports for console application
 *
 * Exports Inngest client, workflows, and route context for Next.js integration
 *
 * Phase 1.5: Multi-source infrastructure (GitHub implementation only)
 */

import { serve } from "inngest/next";
import { inngest } from "./client/client";
import { docsIngestion } from "./workflow/docs-ingestion";
import { ensureStore } from "./workflow/ensure-store";
import { repositoryInitialSync } from "./workflow/repository-initial-sync";

// Phase 1.5: GitHub adapters (bridge to generic workflows)
import {
	githubProcessAdapter,
	githubDeleteAdapter,
} from "./workflow/sources/github-adapter";

// Phase 1.5: Generic multi-source workflows
import { processDocuments } from "./workflow/shared/process-documents";
import { deleteDocuments } from "./workflow/shared/delete-documents";
import { extractRelationships } from "./workflow/shared/extract-relationships";

// Export Inngest client
export { inngest };

// Export core workflows
export { docsIngestion };
export { ensureStore };
export { repositoryInitialSync };

// Export GitHub adapters
export { githubProcessAdapter, githubDeleteAdapter };

// Export generic workflows
export { processDocuments, deleteDocuments, extractRelationships };

/**
 * Create the route context for Next.js API routes
 *
 * This function should be called in the Inngest API route handler
 * to set up the Inngest server with all registered functions.
 *
 * Phase 1.5 workflow architecture:
 * 1. docsIngestion - Receives GitHub webhooks, filters files
 * 2. githubProcessAdapter - Transforms GitHub events to generic format
 * 3. processDocuments - Generic document processor (all sources)
 * 4. githubDeleteAdapter - Transforms GitHub delete events
 * 5. deleteDocuments - Generic document deleter (all sources)
 * 6. extractRelationships - Generic relationship extractor
 * 7. ensureStore - Store provisioning (source-agnostic)
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
			// Core ingestion
			docsIngestion,
			ensureStore,
			repositoryInitialSync,

			// Phase 1.5: GitHub adapters
			githubProcessAdapter,
			githubDeleteAdapter,

			// Phase 1.5: Generic workflows (multi-source ready)
			processDocuments,
			deleteDocuments,
			extractRelationships,
		],
		servePath: "/api/inngest",
	});
}
