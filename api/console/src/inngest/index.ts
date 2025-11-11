/**
 * Inngest exports for console application
 *
 * Exports Inngest client, workflows, and route context for Next.js integration
 */

import { serve } from "inngest/next";
import { inngest } from "./client/client";
import { docsIngestion } from "./workflow/docs-ingestion";
import { ensureStore } from "./workflow/ensure-store";
import { processDoc } from "./workflow/process-doc";
import { deleteDoc } from "./workflow/delete-doc";

// Export Inngest client
export { inngest };

// Export workflows
export { docsIngestion };
export { ensureStore };
export { processDoc };
export { deleteDoc };

/**
 * Create the route context for Next.js API routes
 *
 * This function should be called in the Inngest API route handler
 * to set up the Inngest server with all registered functions.
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
		functions: [docsIngestion, ensureStore, processDoc, deleteDoc],
		servePath: "/api/inngest",
	});
}
