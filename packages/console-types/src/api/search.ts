/**
 * /v1/search API types and schemas
 *
 * @see docs/architecture/phase1/package-structure.md
 */

import { z } from "zod";
import { LatencySchema, RequestIdSchema } from "./common";

/**
 * Search request schema with Zod validation
 */
export const SearchRequestSchema = z.object({
  /** Search query text */
  query: z.string().min(1, "Query must not be empty"),
  /** Number of results to return */
  topK: z.number().int().min(1).max(100).default(10),
  /** Optional filters for scoping results */
  filters: z
    .object({
      /** Store labels for filtering (e.g., ["store:docs-site"]) */
      labels: z.array(z.string()).optional(),
    })
    .optional(),
  /** Whether to include highlighted snippets */
  includeHighlights: z.boolean().default(true),
});

export type SearchRequest = z.infer<typeof SearchRequestSchema>;

/**
 * Individual search result schema
 */
export const SearchResultSchema = z.object({
  /** Document or chunk ID */
  id: z.string(),
  /** Document title */
  title: z.string(),
  /** URL to the document */
  url: z.string(),
  /** Highlighted snippet */
  snippet: z.string(),
  /** Relevance score */
  score: z.number(),
  /** Additional metadata */
  metadata: z.record(z.unknown()),
});

export type SearchResult = z.infer<typeof SearchResultSchema>;

/**
 * Search response schema
 */
export const SearchResponseSchema = z.object({
  /** Array of search results */
  results: z.array(SearchResultSchema),
  /** Request ID for debugging */
  requestId: RequestIdSchema,
  /** Latency breakdown */
  latency: LatencySchema,
});

export type SearchResponse = z.infer<typeof SearchResponseSchema>;
