/**
 * Type utilities for memory tRPC client.
 */
import type { MemoryRouter } from "@api/platform";
import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server";

export type RouterOutputs = inferRouterOutputs<MemoryRouter>;
export type RouterInputs = inferRouterInputs<MemoryRouter>;
