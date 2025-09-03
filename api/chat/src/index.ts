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

// For backward compatibility during migration
export type RouterOutputs = ChatRouterOutputs;
export type RouterInputs = ChatRouterInputs;
export { chatAppRouter as appRouter } from "./root";

// Export TRPC utilities
export { createCallerFactory } from "./trpc";