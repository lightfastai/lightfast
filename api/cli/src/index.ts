/**
 * CLI API - Main exports
 */

export { cliRouter, createCaller, type CliRouter } from "./root";
export { createTRPCContext } from "./trpc";

// Re-export types for convenience
export type { CliSession } from "./trpc";