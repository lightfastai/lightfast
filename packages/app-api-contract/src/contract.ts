import { oc } from "@orpc/contract";
import {
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
};

export type ApiContract = typeof apiContract;
