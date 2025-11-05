// Export router types for client usage
import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server";

import type { DeusAppRouter } from "./root";

/**
 * Deus API exports
 */

// Export the main app router
export { deusAppRouter } from "./root";
export type { DeusAppRouter } from "./root";

// Export context creation
export { createTRPCContext } from "./trpc";

export type DeusRouterInputs = inferRouterInputs<DeusAppRouter>;
export type DeusRouterOutputs = inferRouterOutputs<DeusAppRouter>;

// Export TRPC utilities
export { createCallerFactory } from "./trpc";
