import type { TRPCRouterRecord } from "@trpc/server";

/**
 * Stores Router
 *
 * DEPRECATED: This router is now empty. All M2M procedures have been moved to router/m2m/stores.ts.
 * User-facing store operations are in workspace.stores sub-router.
 *
 * This file is kept for backward compatibility but should be removed in a future cleanup.
 */
export const storesRouter = {} satisfies TRPCRouterRecord;
