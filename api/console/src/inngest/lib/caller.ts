/**
 * Local tRPC caller for Inngest workflows
 *
 * This caller is created locally within api/console to avoid circular dependencies:
 * - Inngest workflows need to call tRPC procedures
 * - tRPC routers need to send Inngest events
 *
 * By keeping the caller local to api/console, we maintain a clean dependency tree
 * without introducing cycles between packages.
 *
 * Authentication:
 * - Uses Inngest M2M token (CLERK_M2M_TOKEN_INNGEST)
 * - Validated by inngestM2MProcedure middleware
 * - Provides full audit trail for all Inngest → DB operations
 *
 * Usage:
 * ```typescript
 * import { createInngestCaller } from "../lib/caller";
 *
 * const trpc = await createInngestCaller();
 * const workspace = await trpc.m2m.workspace.get({ workspaceId });
 * ```
 */

import type { M2MRouter } from "../../root";
import { m2mRouter } from "../../root";
import { createOrgTRPCContext } from "../../trpc";
import { createM2MToken } from "@repo/console-clerk-m2m";

/**
 * Create a tRPC caller authenticated with Inngest M2M token
 *
 * This caller has access to M2M procedures marked with `inngestM2MProcedure`.
 * The token is created on-demand (30s expiration) following Clerk's recommended pattern.
 *
 * M2M operations operate on workspaces, stores, jobs, etc.
 * These procedures are isolated from user-facing operations.
 *
 * @returns Typed tRPC caller instance for M2M procedures
 */
export async function createInngestCaller(): Promise<ReturnType<typeof m2mRouter.createCaller>> {
	const { token } = await createM2MToken("inngest");

	const headers = new Headers();
	headers.set("x-trpc-source", "inngest-workflow");
	headers.set("authorization", `Bearer ${token}`);

	const ctx = await createOrgTRPCContext({ headers });
	return m2mRouter.createCaller(ctx);
}
