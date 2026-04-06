// Export router types for client usage
import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server";

import type { AdminRouter, PlatformRouter } from "./root";

/**
 * Platform API exports
 */

export type { InternalRouter } from "./internal";
export type { AdminRouter, PlatformRouter } from "./root";
export { adminRouter, platformRouter } from "./root";
export type { PlatformAuthContext, PlatformContext } from "./trpc";
// Export context creation
export { createPlatformTRPCContext } from "./trpc";

// Type utilities
export type PlatformRouterInputs = inferRouterInputs<PlatformRouter>;
export type PlatformRouterOutputs = inferRouterOutputs<PlatformRouter>;
export type AdminRouterInputs = inferRouterInputs<AdminRouter>;
export type AdminRouterOutputs = inferRouterOutputs<AdminRouter>;

export type { VerifiedServiceJWT } from "./lib/jwt";

// JWT utilities (for consumers that need to sign tokens)
export { signServiceJWT, verifyServiceJWT } from "./lib/jwt";
// tRPC utilities
export { createCallerFactory } from "./trpc";
