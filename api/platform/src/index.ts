// Export router types for client usage
import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server";

import type { PlatformRouter } from "./root";

/**
 * Platform API exports
 */

export type { InternalRouter } from "./internal";
export type { PlatformRouter } from "./root";
export { platformRouter } from "./root";
export type { PlatformAuthContext, PlatformContext } from "./trpc";
// Export context creation
export { createPlatformTRPCContext } from "./trpc";

// Type utilities
export type PlatformRouterInputs = inferRouterInputs<PlatformRouter>;
export type PlatformRouterOutputs = inferRouterOutputs<PlatformRouter>;

export type { ServiceCaller, VerifiedServiceJWT } from "./lib/jwt";

// JWT utilities (for consumers that need to sign tokens)
export {
  SERVICE_CALLERS,
  signServiceJWT,
  verifyServiceJWT,
} from "./lib/jwt";
// tRPC utilities
export { createCallerFactory, serviceProcedure } from "./trpc";
