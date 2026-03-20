// Export router types for client usage
import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server";

import type { AdminRouter, MemoryRouter } from "./root";

/**
 * Memory API exports
 */

export type { AdminRouter, MemoryRouter } from "./root";
export { adminRouter, memoryRouter } from "./root";

// Export context creation
export { createMemoryTRPCContext } from "./trpc";
export type { MemoryAuthContext } from "./trpc";

// Type utilities
export type MemoryRouterInputs = inferRouterInputs<MemoryRouter>;
export type MemoryRouterOutputs = inferRouterOutputs<MemoryRouter>;
export type AdminRouterInputs = inferRouterInputs<AdminRouter>;
export type AdminRouterOutputs = inferRouterOutputs<AdminRouter>;

// tRPC utilities
export { createCallerFactory } from "./trpc";

// JWT utilities (for consumers that need to sign tokens)
export { signServiceJWT, verifyServiceJWT } from "./lib/jwt";
export type { VerifiedServiceJWT } from "./lib/jwt";
