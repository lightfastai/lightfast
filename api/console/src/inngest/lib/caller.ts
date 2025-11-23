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

import type { ConsoleAppRouter } from "../../root";
import { consoleAppRouter } from "../../root";
import { createTRPCContext } from "../../trpc";
import { getM2MToken } from "@repo/console-clerk-m2m";

/**
 * Create a tRPC caller authenticated with Inngest M2M token
 *
 * This caller has access to all procedures marked with `inngestM2MProcedure`.
 * The token is validated to ensure it comes from the Inngest machine.
 *
 * @returns Typed tRPC caller instance
 */
export async function createInngestCaller(): Promise<
	ReturnType<ConsoleAppRouter["createCaller"]>
> {
	const token = getM2MToken("inngest");

	const headers = new Headers();
	headers.set("x-trpc-source", "inngest-workflow");
	headers.set("authorization", `Bearer ${token}`);

	const ctx = await createTRPCContext({ headers });
	return consoleAppRouter.createCaller(ctx);
}
