// Export router types for client usage
import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server";

import type { UserRouter, OrgRouter } from "./root";

/**
 * Console API exports
 */

// Export split routers (user-scoped and org-scoped)
export { userRouter, orgRouter } from "./root";
export type { UserRouter, OrgRouter } from "./root";

// Export split context creation functions
export { createUserTRPCContext, createOrgTRPCContext } from "./trpc";

// Type utilities for split routers
export type UserRouterInputs = inferRouterInputs<UserRouter>;
export type UserRouterOutputs = inferRouterOutputs<UserRouter>;
export type OrgRouterInputs = inferRouterInputs<OrgRouter>;
export type OrgRouterOutputs = inferRouterOutputs<OrgRouter>;

// Export TRPC utilities
export { createCallerFactory } from "./trpc";
