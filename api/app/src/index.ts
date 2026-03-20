import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "./root";

export type { AppRouter } from "./root";
export { appRouter } from "./root";
export { createTRPCContext } from "./trpc";

// Type utilities
export type AppRouterInputs = inferRouterInputs<AppRouter>;
export type AppRouterOutputs = inferRouterOutputs<AppRouter>;

export { createCallerFactory } from "./trpc";
