import { z } from "zod";

// --- Request ---

export const SearchModeSchema = z.enum(["fast", "balanced"]);

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
  mode: SearchModeSchema.default("balanced").describe(
    "Search quality mode: 'fast' (vector scores only), 'balanced' (Cohere rerank)"
  ),
  sources: z
    .array(z.string())
    .optional()
    .describe(
      'Filter by source provider (e.g. ["github", "linear", "sentry"])'
    ),
  types: z
    .array(z.string())
    .optional()
    .describe(
      'Filter by entity type (e.g. ["pull_request", "issue", "error"])'
    ),
  after: z
    .string()
    .datetime()
    .optional()
    .describe("Only include results after this ISO 8601 datetime"),
  before: z
    .string()
    .datetime()
    .optional()
    .describe("Only include results before this ISO 8601 datetime"),
});

export type SearchRequest = z.infer<typeof SearchRequestSchema>;
export type SearchMode = z.infer<typeof SearchModeSchema>;

// --- Result ---

export const SearchResultSchema = z.object({
  id: z.string(),
  title: z.string(),
  snippet: z.string(),
  score: z.number(),
  source: z.string(),
  type: z.string(),
  url: z.string().nullable(),
  occurredAt: z.string().datetime().nullable(),
});

export type SearchResult = z.infer<typeof SearchResultSchema>;

// --- Response ---

export const SearchResponseSchema = z.object({
  results: z.array(SearchResultSchema),
  total: z.number().int().nonnegative(),
  requestId: z.string(),
});

export type SearchResponse = z.infer<typeof SearchResponseSchema>;
