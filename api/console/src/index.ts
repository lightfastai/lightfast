// Export router types for client usage
import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server";

import type { UserRouter, OrgRouter, M2MRouter } from "./root";

/**
 * Console API exports
 */

// Export split routers (user-scoped, org-scoped, and M2M)
export { userRouter, orgRouter, m2mRouter } from "./root";
export type { UserRouter, OrgRouter, M2MRouter } from "./root";

// Export split context creation functions
export { createUserTRPCContext, createOrgTRPCContext } from "./trpc";

// Type utilities for split routers
export type UserRouterInputs = inferRouterInputs<UserRouter>;
export type UserRouterOutputs = inferRouterOutputs<UserRouter>;
export type OrgRouterInputs = inferRouterInputs<OrgRouter>;
export type OrgRouterOutputs = inferRouterOutputs<OrgRouter>;
export type M2MRouterInputs = inferRouterInputs<M2MRouter>;
export type M2MRouterOutputs = inferRouterOutputs<M2MRouter>;

// Export TRPC utilities
export { createCallerFactory } from "./trpc";
