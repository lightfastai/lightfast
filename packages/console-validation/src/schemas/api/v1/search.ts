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
 *
 * IMPORTANT: When adding/changing fields with .default() here, update the SDK's SearchInput type
 * in core/lightfast/src/types.ts to make those fields optional for better developer experience.
 * The SDK client applies defaults before API calls (see core/lightfast/src/client.ts).
 */
export const V1SearchRequestSchema = z.object({
  /** Search query text */
  query: z
    .string()
    .min(1, "Query must not be empty")
    .describe("The search query text to find relevant documents"),
  /** Number of results to return (1-100, default 10) */
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .default(10)
    .describe("Maximum number of results to return (1-100, default: 10)"),
  /** Result offset for pagination (default 0) */
  offset: z
    .number()
    .int()
    .min(0)
    .default(0)
    .describe("Result offset for pagination (default: 0)"),
  /** Rerank mode for result quality (default: balanced) */
  mode: RerankModeSchema.default("balanced").describe(
    "Search quality mode: 'fast' (speed), 'balanced' (default), 'thorough' (quality)"
  ),
  /** Optional filters for scoping results */
  filters: V1SearchFiltersSchema.optional().describe(
    "Optional filters to scope results by source type, observation type, actors, or date range"
  ),
  /** Include cluster and actor context (default: true) */
  includeContext: z
    .boolean()
    .default(true)
    .describe("Include contextual information like topic clusters (default: true)"),
  /** Include highlighted snippets (default: true) */
  includeHighlights: z
    .boolean()
    .default(true)
    .describe("Include highlighted text snippets (default: true)"),
});

export type V1SearchRequest = z.infer<typeof V1SearchRequestSchema>;

/**
 * V1 API source reference - links to related external resources
 */
export const V1SourceReferenceSchema = z.object({
  /** Reference type (e.g., "commit", "issue", "pr", "branch", "project") */
  type: z.string(),
  /** Reference identifier */
  id: z.string(),
  /** URL to the referenced resource */
  url: z.string().optional(),
  /** Human-readable label for the reference */
  label: z.string().optional(),
});

export type V1SourceReference = z.infer<typeof V1SourceReferenceSchema>;

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
  /** Cross-source references (commits, issues, PRs, branches) */
  references: z.array(V1SourceReferenceSchema).optional(),
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
  /** Authentication (API key or session validation) */
  auth: z.number().nonnegative().optional(),
  /** JSON parsing and Zod validation */
  parse: z.number().nonnegative().optional(),
  /** Total 4-path search latency (includes embedding + parallel retrieval) */
  search: z.number().nonnegative().optional(),
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
  /** Database enrichment (fetch full observation metadata + entities) */
  enrich: z.number().nonnegative().optional(),
  /**
   * Maximum latency among parallel operations (retrieval, entitySearch, clusterSearch, actorSearch).
   * This represents the bottleneck operation that determines parallel phase duration.
   */
  maxParallel: z.number().nonnegative().optional(),
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
