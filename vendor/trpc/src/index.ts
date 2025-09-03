/**
 * Lightweight TRPC SDK for Lightfast infrastructure
 * Provides core TRPC utilities that can be used by any app
 */

// Export core TRPC utilities
export type { BaseContext } from "./core";
export {
  createTRPCBase,
  createTimingMiddleware,
  createAuthMiddleware,
  TRPCError,
} from "./core";
export type {
  inferRouterInputs,
  inferRouterOutputs,
  inferProcedureInput,
  inferProcedureOutput,
} from "./core";

// Export header utilities (shared across apps)
export {
  $TRPCSource,
  $TRPCHeaderName,
  createTRPCHeaders,
  getHeaderFromTRPCHeaders,
} from "./headers";
export type {
  TRPCSource,
  TRPCHeaderName,
} from "./headers";

// Note: App-specific routers are now in their own packages (api/chat, api/cloud)