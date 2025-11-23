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
 * const workspace = await trpc.workspace.getForInngest({ workspaceId });
 * ```
 */

import type { OrgRouter } from "../../root";
import { orgRouter } from "../../root";
import { createOrgTRPCContext } from "../../trpc";
import { getM2MToken } from "@repo/console-clerk-m2m";

/**
 * Create a tRPC caller authenticated with Inngest M2M token
 *
 * This caller has access to org-scoped procedures marked with `inngestM2MProcedure`.
 * The token is validated to ensure it comes from the Inngest machine.
 *
 * M2M operations are always org-scoped - they operate on workspaces, stores, jobs, etc.
 * There are no user-scoped M2M procedures.
 *
 * @returns Typed tRPC caller instance for org-scoped procedures
 */
export async function createInngestCaller(): Promise<ReturnType<typeof orgRouter.createCaller>> {
	const token = getM2MToken("inngest");

	const headers = new Headers();
	headers.set("x-trpc-source", "inngest-workflow");
	headers.set("authorization", `Bearer ${token}`);

	const ctx = await createOrgTRPCContext({ headers });
	return orgRouter.createCaller(ctx);
}
