/**
 * /v1/search API schemas
 *
 * Extended search schemas for the public v1 API with mode-based reranking.
 */

import { z } from "zod";

/**
 * Rerank mode for search quality
 * - fast: No reranking, vector scores only (~50ms)
 * - balanced: Cohere rerank (~130ms)
 * - thorough: LLM-based scoring (~600ms)
 */
export const RerankModeSchema = z.enum(["fast", "balanced", "thorough"]);
export type RerankMode = z.infer<typeof RerankModeSchema>;

/**
 * Search filters for scoping results
 */
export const V1SearchFiltersSchema = z.object({
  /** Source types to include (e.g., ["github", "linear"]) */
  sourceTypes: z.array(z.string()).optional(),
  /** Observation types to include (e.g., ["commit", "issue"]) */
  observationTypes: z.array(z.string()).optional(),
  /** Actor names to filter by (e.g., ["@sarah", "@mike"]) */
  actorNames: z.array(z.string()).optional(),
  /** Date range filter */
  dateRange: z
    .object({
      start: z.string().datetime().optional(),
      end: z.string().datetime().optional(),
    })
    .optional(),
});

export type V1SearchFilters = z.infer<typeof V1SearchFiltersSchema>;

/**
 * V1 Search request schema
 */
export const V1SearchRequestSchema = z.object({
  /** Search query text */
  query: z.string().min(1, "Query must not be empty"),
  /** Number of results to return (1-100, default 10) */
  limit: z.number().int().min(1).max(100).default(10),
  /** Result offset for pagination (default 0) */
  offset: z.number().int().min(0).default(0),
  /** Rerank mode for result quality (default: balanced) */
  mode: RerankModeSchema.default("balanced"),
  /** Optional filters for scoping results */
  filters: V1SearchFiltersSchema.optional(),
  /** Include cluster and actor context (default: true) */
  includeContext: z.boolean().default(true),
  /** Include highlighted snippets (default: true) */
  includeHighlights: z.boolean().default(true),
});

export type V1SearchRequest = z.infer<typeof V1SearchRequestSchema>;

/**
 * Individual search result
 */
export const V1SearchResultSchema = z.object({
  /** Observation ID */
  id: z.string(),
  /** Document/observation title */
  title: z.string(),
  /** URL to the source document */
  url: z.string(),
  /** Content snippet */
  snippet: z.string(),
  /** Combined relevance score (0-1) */
  score: z.number(),
  /** Source type (e.g., "github", "linear") */
  source: z.string(),
  /** Observation type (e.g., "commit", "issue") */
  type: z.string(),
  /** When the observation occurred */
  occurredAt: z.string().datetime().optional(),
  /** Extracted entities */
  entities: z
    .array(
      z.object({
        key: z.string(),
        category: z.string(),
      })
    )
    .optional(),
  /** Highlighted snippet (if includeHighlights) */
  highlights: z
    .object({
      title: z.string().optional(),
      snippet: z.string().optional(),
    })
    .optional(),
});

export type V1SearchResult = z.infer<typeof V1SearchResultSchema>;

/**
 * Search context with clusters and actors
 */
export const V1SearchContextSchema = z.object({
  /** Related topic clusters */
  clusters: z
    .array(
      z.object({
        topic: z.string().nullable(),
        summary: z.string().nullable(),
        keywords: z.array(z.string()),
      })
    )
    .optional(),
  /** Relevant actors/contributors */
  relevantActors: z
    .array(
      z.object({
        displayName: z.string(),
        expertiseDomains: z.array(z.string()),
      })
    )
    .optional(),
});

export type V1SearchContext = z.infer<typeof V1SearchContextSchema>;

/**
 * Latency breakdown
 */
export const V1SearchLatencySchema = z.object({
  /** Total request latency */
  total: z.number().nonnegative(),
  /** Embedding generation */
  embedding: z.number().nonnegative().optional(),
  /** Vector retrieval */
  retrieval: z.number().nonnegative(),
  /** Entity search */
  entitySearch: z.number().nonnegative().optional(),
  /** Cluster search */
  clusterSearch: z.number().nonnegative().optional(),
  /** Actor search */
  actorSearch: z.number().nonnegative().optional(),
  /** Reranking latency */
  rerank: z.number().nonnegative(),
});

export type V1SearchLatency = z.infer<typeof V1SearchLatencySchema>;

/**
 * Response metadata
 */
export const V1SearchMetaSchema = z.object({
  /** Total matching results (before pagination) */
  total: z.number().nonnegative(),
  /** Results returned in this page */
  limit: z.number(),
  /** Current offset */
  offset: z.number(),
  /** Total request time in ms */
  took: z.number().nonnegative(),
  /** Rerank mode used */
  mode: RerankModeSchema,
  /** Search paths executed */
  paths: z.object({
    vector: z.boolean(),
    entity: z.boolean(),
    cluster: z.boolean(),
    actor: z.boolean(),
  }),
});

export type V1SearchMeta = z.infer<typeof V1SearchMetaSchema>;

/**
 * V1 Search response schema
 */
export const V1SearchResponseSchema = z.object({
  /** Search results */
  data: z.array(V1SearchResultSchema),
  /** Optional context (clusters, actors) */
  context: V1SearchContextSchema.optional(),
  /** Response metadata */
  meta: V1SearchMetaSchema,
  /** Latency breakdown */
  latency: V1SearchLatencySchema,
  /** Request ID for debugging */
  requestId: z.string(),
});

export type V1SearchResponse = z.infer<typeof V1SearchResponseSchema>;
