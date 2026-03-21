import { z } from "zod";
import {
  EventBaseSchema,
  RerankModeSchema,
  SearchFiltersSchema,
  SourceReferenceSchema,
} from "./common";

export const SearchRequestSchema = z.object({
  query: z
    .string()
    .min(1, "Query must not be empty")
    .describe("The search query text to find relevant documents"),
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .default(10)
    .describe("Maximum number of results to return (1-100, default: 10)"),
  offset: z
    .number()
    .int()
    .min(0)
    .default(0)
    .describe("Result offset for pagination (default: 0)"),
  mode: RerankModeSchema.default("balanced").describe(
    "Search quality mode: 'fast' (speed), 'balanced' (default), 'thorough' (quality)"
  ),
  filters: SearchFiltersSchema.optional().describe(
    "Optional filters to scope results by source type, observation type, or date range"
  ),
});
export type SearchRequest = z.infer<typeof SearchRequestSchema>;

export const SearchResultSchema = EventBaseSchema.extend({
  snippet: z.string(),
  score: z.number(),
  latestAction: z.string().optional(),
  totalEvents: z.number().optional(),
  significanceScore: z.number().optional(),
  entities: z
    .array(z.object({ key: z.string(), category: z.string() }))
    .optional(),
  references: z.array(SourceReferenceSchema).optional(),
});
export type SearchResult = z.infer<typeof SearchResultSchema>;

export const SearchContextSchema = z.object({
  clusters: z
    .array(
      z.object({
        topic: z.string().nullable(),
        summary: z.string().nullable(),
        keywords: z.array(z.string()),
      })
    )
    .optional(),
});
export type SearchContext = z.infer<typeof SearchContextSchema>;

export const SearchLatencySchema = z.object({
  total: z.number().nonnegative(),
  auth: z.number().nonnegative().optional(),
  parse: z.number().nonnegative().optional(),
  search: z.number().nonnegative().optional(),
  embedding: z.number().nonnegative().optional(),
  retrieval: z.number().nonnegative(),
  entitySearch: z.number().nonnegative().optional(),
  clusterSearch: z.number().nonnegative().optional(),
  rerank: z.number().nonnegative(),
  enrich: z.number().nonnegative().optional(),
  maxParallel: z.number().nonnegative().optional(),
});
export type SearchLatency = z.infer<typeof SearchLatencySchema>;

export const SearchResponseSchema = z.object({
  data: z.array(SearchResultSchema),
  context: SearchContextSchema.optional(),
  meta: z.object({
    total: z.number().nonnegative(),
    limit: z.number(),
    offset: z.number(),
    took: z.number().nonnegative(),
    mode: RerankModeSchema,
    paths: z.object({
      vector: z.boolean(),
      entity: z.boolean(),
      cluster: z.boolean(),
    }),
  }),
  latency: SearchLatencySchema.optional(),
  requestId: z.string(),
});
export type SearchResponse = z.infer<typeof SearchResponseSchema>;
