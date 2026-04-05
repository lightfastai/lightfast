import { createORPCClient } from "@orpc/client";
import type { ContractRouterClient } from "@orpc/contract";
import type { JsonifiedClient } from "@orpc/openapi-client";
import { OpenAPILink } from "@orpc/openapi-client/fetch";
import { apiContract } from "@repo/app-api-contract";

declare const __SDK_VERSION__: string;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Fully-typed Lightfast API client. */
export type LightfastClient = JsonifiedClient<
  ContractRouterClient<typeof apiContract>
>;

export interface LightfastOptions {
  /** API base URL. Defaults to `https://lightfast.ai`. */
  baseUrl?: string;
}

// ---------------------------------------------------------------------------
// Re-exports — schemas & types (single source of truth for consumers + MCP)
// ---------------------------------------------------------------------------

export type {
  ProxyAction,
  ProxyCall,
  ProxyCallResponse,
  ProxyConnection,
  ProxyResource,
  ProxySearchResponse,
  SearchMode,
  SearchRequest,
  SearchResponse,
  SearchResult,
} from "@repo/app-validation/api";

export {
  ProxyActionSchema,
  ProxyCallResponseSchema,
  ProxyCallSchema,
  ProxyConnectionSchema,
  ProxyResourceSchema,
  ProxySearchResponseSchema,
  SearchModeSchema,
  SearchRequestSchema,
  SearchResponseSchema,
  SearchResultSchema,
} from "@repo/app-validation/api";

// ---------------------------------------------------------------------------
// Re-exports — error handling utilities
// ---------------------------------------------------------------------------

export { isDefinedError, ORPCError, safe } from "@orpc/client";

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Create a Lightfast API client.
 *
 * @example
 * ```ts
 * import { createLightfast } from "lightfast";
 *
 * const lf = createLightfast("sk-lf-...");
 * const { results } = await lf.search({ query: "deployment errors" });
 * ```
 */
export function createLightfast(
  apiKey: string,
  options?: LightfastOptions
): LightfastClient {
  const link = new OpenAPILink(apiContract, {
    url: options?.baseUrl ?? "https://lightfast.ai",
    headers: () => ({
      authorization: `Bearer ${apiKey}`,
      "x-sdk-version": `lightfast-node/${__SDK_VERSION__}`,
    }),
  });

  return createORPCClient(link) as LightfastClient;
}

/** SDK version, injected at build time. */
export const VERSION = __SDK_VERSION__;
