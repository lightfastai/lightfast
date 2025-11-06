// Export router types for client usage
import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server";

import type { ConsoleAppRouter } from "./root";

/**
 * Console API exports
 */

// Export the main app router
export { consoleAppRouter } from "./root";
export type { ConsoleAppRouter } from "./root";

// Export context creation
export { createTRPCContext } from "./trpc";

export type ConsoleRouterInputs = inferRouterInputs<ConsoleAppRouter>;
export type ConsoleRouterOutputs = inferRouterOutputs<ConsoleAppRouter>;

// Export TRPC utilities
export { createCallerFactory } from "./trpc";
