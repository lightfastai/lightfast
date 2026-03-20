// Export router types for client usage
import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server";

import type { OrgRouter, UserRouter } from "./root";

/**
 * Console API exports
 */

export type { OrgRouter, UserRouter } from "./root";
// Export split routers (user-scoped, org-scoped)
export { orgRouter, userRouter } from "./root";

// Export split context creation functions
export { createOrgTRPCContext, createUserTRPCContext } from "./trpc";

// Type utilities for split routers
export type UserRouterInputs = inferRouterInputs<UserRouter>;
export type UserRouterOutputs = inferRouterOutputs<UserRouter>;
export type OrgRouterInputs = inferRouterInputs<OrgRouter>;
export type OrgRouterOutputs = inferRouterOutputs<OrgRouter>;

// Export TRPC utilities
export { createCallerFactory } from "./trpc";
