import { oc } from "@orpc/contract";
import {
  ProxyExecuteRequestSchema,
  ProxyExecuteResponseSchema,
  ProxySearchResponseSchema,
  SearchRequestSchema,
  SearchResponseSchema,
} from "@repo/app-validation/api";

/**
 * Lightfast Public API Contract
 *
 * Defines the API surface for the /v1/* endpoints.
 * This contract is the single source of truth for:
 * - Route handlers (apps/app implements this via oRPC)
 * - OpenAPI spec generation (committed openapi.json)
 * - SDK type inference (via openapi-typescript)
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
      .input(ProxyExecuteRequestSchema)
      .output(ProxyExecuteResponseSchema),
  },
};

export type ApiContract = typeof apiContract;
