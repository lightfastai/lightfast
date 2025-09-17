/**
 * Chat API exports
 */

// Export the main app router
export { chatAppRouter } from "./root";
export type { ChatAppRouter } from "./root";

// Export context creation
export { createTRPCContext } from "./trpc";

// Export router types for client usage
import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server";
import type { ChatAppRouter } from "./root";

export type ChatRouterInputs = inferRouterInputs<ChatAppRouter>;
export type ChatRouterOutputs = inferRouterOutputs<ChatAppRouter>;


// Export TRPC utilities
export { createCallerFactory } from "./trpc";

// Export billing utilities
export { calculateBillingPeriod } from "./router/chat/usage";