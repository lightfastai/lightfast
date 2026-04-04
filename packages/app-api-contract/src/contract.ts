import { oc } from "@orpc/contract";
import {
  ProxyExecuteRequestSchema,
  ProxyExecuteResponseSchema,
  ProxySearchResponseSchema,
  SearchRequestSchema,
  SearchResponseSchema,
} from "@repo/app-validation/api";
import { z } from "zod";

const apiErrors = {
  UNAUTHORIZED: {
    message: "Authentication required",
  },
  FORBIDDEN: {
    message: "Access denied",
  },
  NOT_FOUND: {
    message: "Resource not found",
    data: z.object({
      resource: z
        .string()
        .describe("The type of resource that was not found")
        .optional(),
    }),
  },
  BAD_REQUEST: {
    message: "Invalid request",
    data: z.object({
      field: z
        .string()
        .describe("The request field that caused the error")
        .optional(),
      reason: z.string().describe("Why the request is invalid").optional(),
    }),
  },
};

/**
 * Lightfast Public API Contract
 *
 * Defines the API surface for the /v1/* endpoints.
 * This contract is the single source of truth for:
 * - Route handlers (apps/app implements this via oRPC)
 * - OpenAPI spec generation (committed openapi.json)
 * - SDK type inference and client generation
 * - MCP tool registration (via @vendor/mcp contract adapter)
 * - Documentation rendering (via fumadocs-openapi)
 */
export const apiContract = {
  search: oc
    .route({
      method: "POST",
      path: "/v1/search",
      tags: ["Search"],
      summary: "Search",
      description:
        "Search across your team's knowledge with semantic understanding and multi-path retrieval.",
    })
    .errors(apiErrors)
    .input(SearchRequestSchema)
    .output(SearchResponseSchema),

  proxy: {
    search: oc
      .route({
        method: "POST",
        path: "/v1/proxy/search",
        tags: ["Proxy"],
        summary: "List proxy endpoints",
        description:
          "Discover all connected providers and their available API endpoints. Returns the full endpoint catalog for each active connection.",
      })
      .errors(apiErrors)
      .output(ProxySearchResponseSchema),

    execute: oc
      .route({
        method: "POST",
        path: "/v1/proxy/execute",
        tags: ["Proxy"],
        summary: "Execute proxy request",
        description:
          "Execute an API call through a connected provider. Authentication is injected automatically — you only need to specify the endpoint and parameters.",
      })
      .errors(apiErrors)
      .input(ProxyExecuteRequestSchema)
      .output(ProxyExecuteResponseSchema),
  },
};

export type ApiContract = typeof apiContract;
