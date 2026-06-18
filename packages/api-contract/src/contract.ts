import type { z } from "zod";

import {
  createSignalInput,
  createSignalOutput,
  getSignalInput,
  getSignalOutput,
} from "./schemas/signals";
import { systemHealthOutput } from "./schemas/system";

export interface PublicApiRouteMetadata {
  description: string;
  method: "DELETE" | "GET" | "PATCH" | "POST" | "PUT";
  path: string;
  successStatus?: number;
  summary: string;
}

export interface PublicApiContractProcedure<
  TInputSchema extends z.ZodTypeAny | undefined = z.ZodTypeAny | undefined,
  TOutputSchema extends z.ZodTypeAny = z.ZodTypeAny,
> {
  inputSchema?: TInputSchema;
  outputSchema: TOutputSchema;
  route: PublicApiRouteMetadata;
}

export type PublicApiContractNode =
  | PublicApiContractProcedure
  | { [key: string]: PublicApiContractNode };

export type PublicApiContract = Record<string, PublicApiContractNode>;

export function publicApiProcedure<
  TInputSchema extends z.ZodTypeAny | undefined,
  TOutputSchema extends z.ZodTypeAny,
>(input: {
  inputSchema?: TInputSchema;
  outputSchema: TOutputSchema;
  route: PublicApiRouteMetadata;
}): PublicApiContractProcedure<TInputSchema, TOutputSchema> {
  return input;
}

export function isPublicApiContractProcedure(
  node: unknown
): node is PublicApiContractProcedure {
  if (!node || typeof node !== "object") {
    return false;
  }
  const candidate = node as { outputSchema?: unknown; route?: unknown };
  return (
    typeof candidate.outputSchema === "object" &&
    candidate.outputSchema !== null &&
    typeof candidate.route === "object" &&
    candidate.route !== null
  );
}

const system = {
  health: publicApiProcedure({
    outputSchema: systemHealthOutput,
    route: {
      method: "GET",
      path: "/system/health",
      summary: "Health check",
      description:
        "Returns service status, server timestamp, and API version. Requires a valid org API key.",
    },
  }),
};

const signals = {
  create: publicApiProcedure({
    inputSchema: createSignalInput,
    outputSchema: createSignalOutput,
    route: {
      method: "POST",
      path: "/signals",
      successStatus: 202,
      summary: "Create signal",
      description:
        "Creates a creator-visible signal from raw text and queues asynchronous classification.",
    },
  }),

  get: publicApiProcedure({
    inputSchema: getSignalInput,
    outputSchema: getSignalOutput,
    route: {
      method: "GET",
      path: "/signals/{id}",
      summary: "Get signal",
      description:
        "Returns a visible signal and its current classification state.",
    },
  }),
};

export const apiContract = { signals, system };

export type Contract = typeof apiContract;
