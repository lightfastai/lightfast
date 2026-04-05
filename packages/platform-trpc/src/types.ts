/**
 * Type utilities for platform tRPC client.
 */
import type { PlatformRouter } from "@api/platform";
import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server";

export type RouterOutputs = inferRouterOutputs<PlatformRouter>;
export type RouterInputs = inferRouterInputs<PlatformRouter>;
