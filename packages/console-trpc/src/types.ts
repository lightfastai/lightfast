/**
 * Type utilities for console tRPC client
 *
 * Provides typed helpers for tRPC router inputs and outputs
 */

import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server";
import type { UserRouter, OrgRouter } from "@api/console";

/**
 * Combined router type for split user/org routers
 */
type ConsoleRouters = UserRouter & OrgRouter;

/**
 * Inferred output types for all tRPC procedures
 *
 * Usage:
 * ```typescript
 * import type { RouterOutputs } from "@repo/console-trpc";
 *
 * type Workspace = RouterOutputs["workspace"]["resolveFromClerkOrgId"];
 * type Connection = RouterOutputs["integration"]["workspace"]["list"][number];
 * ```
 */
export type RouterOutputs = inferRouterOutputs<ConsoleRouters>;

/**
 * Inferred input types for all tRPC procedures
 *
 * Usage:
 * ```typescript
 * import type { RouterInputs } from "@repo/console-trpc";
 *
 * type CreateResourceInput = RouterInputs["integration"]["resources"]["create"];
 * ```
 */
export type RouterInputs = inferRouterInputs<ConsoleRouters>;
