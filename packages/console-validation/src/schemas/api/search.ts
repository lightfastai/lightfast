import { z } from "zod";
import {
  EventBaseSchema,
  RerankModeSchema,
  SearchFiltersSchema,
  SourceReferenceSchema,
} from "./common";

export const SearchRequestSchema = z.object({
  query: z.string().min(1),
  limit: z.number().int().min(1).max(100).default(10),
  offset: z.number().int().min(0).default(0),
  mode: RerankModeSchema.default("balanced"),
  filters: SearchFiltersSchema.optional(),
});
export type SearchRequest = z.infer<typeof SearchRequestSchema>;

export const SearchResultSchema = EventBaseSchema.extend({
  snippet: z.string(),
  score: z.number(),
  entities: z
    .array(z.object({ key: z.string(), category: z.string() }))
    .optional(),
  references: z.array(SourceReferenceSchema).optional(),
});
export type SearchResult = z.infer<typeof SearchResultSchema>;

export const SearchResponseSchema = z.object({
  data: z.array(SearchResultSchema),
  meta: z.object({
    total: z.number().nonnegative(),
    limit: z.number(),
    offset: z.number(),
    mode: RerankModeSchema,
  }),
  requestId: z.string(),
});
export type SearchResponse = z.infer<typeof SearchResponseSchema>;
