import { oc } from "@orpc/contract";
import {
  ProxyCallResponseSchema,
  ProxyCallSchema,
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
        summary: "Discover connections and actions",
        description:
          "Discover connected providers, their resources, and available actions. Returns connection IDs, resource names with pre-computed action params, and the full action catalog. Call this first to learn what you can do, then use proxy.call to execute actions.",
      })
      .errors(apiErrors)
      .output(ProxySearchResponseSchema),

    call: oc
      .route({
        method: "POST",
        path: "/v1/proxy/call",
        tags: ["Proxy"],
        summary: "Execute a provider action",
        description:
          "Execute a provider API action. Use action strings from proxy.search (e.g. 'github.list-pull-requests'). Pass a flat params object — resource params from the search response can be spread directly into the call. Auth is handled automatically.",
      })
      .errors(apiErrors)
      .input(ProxyCallSchema)
      .output(ProxyCallResponseSchema),
  },
};

export type ApiContract = typeof apiContract;
