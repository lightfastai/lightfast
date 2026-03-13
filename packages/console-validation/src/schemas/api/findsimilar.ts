import { z } from "zod";
import { EventBaseSchema, SearchFiltersSchema } from "./common";

export const FindSimilarRequestSchema = z
  .object({
    id: z.string().optional(),
    url: z.string().url().optional(),
    limit: z.number().int().min(1).max(50).default(10),
    threshold: z.number().min(0).max(1).default(0.5),
    sameSourceOnly: z.boolean().default(false),
    excludeIds: z.array(z.string()).optional(),
    filters: SearchFiltersSchema.optional(),
  })
  .refine((data) => data.id || data.url, {
    message: "Either 'id' or 'url' must be provided",
  });
export type FindSimilarRequest = z.infer<typeof FindSimilarRequestSchema>;

export const FindSimilarResultSchema = EventBaseSchema.extend({
  snippet: z.string().optional(),
  score: z.number(),
  similarity: z.number(),
  entityOverlap: z.number().optional(),
});
export type FindSimilarResult = z.infer<typeof FindSimilarResultSchema>;

export const FindSimilarSourceSchema = EventBaseSchema.pick({
  id: true,
  title: true,
  type: true,
});
export type FindSimilarSource = z.infer<typeof FindSimilarSourceSchema>;

export const FindSimilarResponseSchema = z.object({
  data: z.object({
    source: FindSimilarSourceSchema,
    similar: z.array(FindSimilarResultSchema),
  }),
  meta: z.object({
    total: z.number(),
  }),
  requestId: z.string(),
});
export type FindSimilarResponse = z.infer<typeof FindSimilarResponseSchema>;
