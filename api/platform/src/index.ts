import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server";
import type { PlatformRouter } from "./root";

export type { PlatformRouter } from "./root";
export { platformRouter } from "./root";
export { createPlatformTRPCContext } from "./trpc";

// Type utilities
export type PlatformRouterInputs = inferRouterInputs<PlatformRouter>;
export type PlatformRouterOutputs = inferRouterOutputs<PlatformRouter>;

export { createCallerFactory } from "./trpc";

// Service JWT (for platform-client consumers)
export type { ServiceCaller } from "./lib/jwt";
export { signServiceJWT, verifyServiceJWT } from "./lib/jwt";
