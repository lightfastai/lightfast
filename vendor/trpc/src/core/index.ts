/**
 * Core TRPC SDK exports
 */

export * from "./base";
export * from "./context";

// Re-export useful types and utilities from @trpc/server
export type {
  inferRouterInputs,
  inferRouterOutputs,
  inferProcedureInput,
  inferProcedureOutput,
} from "@trpc/server";

export { TRPCError } from "@trpc/server";