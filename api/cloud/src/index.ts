// Export router types for client usage
import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server";

import type { CloudAppRouter } from "./root";

/**
 * Cloud API exports
 */

// Export the main app router
export { cloudAppRouter } from "./root";
export type { CloudAppRouter } from "./root";

// Export context creation
export { createTRPCContext } from "./trpc";

export type CloudRouterInputs = inferRouterInputs<CloudAppRouter>;
export type CloudRouterOutputs = inferRouterOutputs<CloudAppRouter>;

// Export TRPC utilities
export { createCallerFactory } from "./trpc";
