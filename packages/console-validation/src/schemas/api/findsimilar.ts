import { z } from "zod";
import { EventBaseSchema, SearchFiltersSchema } from "./common";

export const FindSimilarRequestSchema = z
  .object({
    id: z
      .string()
      .optional()
      .describe("Document ID to find similar content for"),
    url: z
      .string()
      .url()
      .optional()
      .describe("URL to find similar content for (alternative to id)"),
    limit: z
      .number()
      .int()
      .min(1)
      .max(50)
      .default(10)
      .describe(
        "Maximum number of similar items to return (1-50, default: 10)"
      ),
    threshold: z
      .number()
      .min(0)
      .max(1)
      .default(0.5)
      .describe("Minimum similarity score 0-1 (default: 0.5)"),
    sameSourceOnly: z
      .boolean()
      .default(false)
      .describe(
        "Only return results from the same source type (default: false)"
      ),
    excludeIds: z
      .array(z.string())
      .optional()
      .describe("Array of IDs to exclude from results"),
    filters: SearchFiltersSchema.optional().describe(
      "Optional filters to scope results"
    ),
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
    took: z.number(),
  }),
  requestId: z.string(),
});
export type FindSimilarResponse = z.infer<typeof FindSimilarResponseSchema>;
