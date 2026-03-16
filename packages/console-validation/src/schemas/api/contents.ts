import { z } from "zod";
import { EventBaseSchema } from "./common";

export const ContentsRequestSchema = z.object({
  ids: z
    .array(z.string())
    .min(1, "At least one ID required")
    .max(50, "Maximum 50 IDs per request")
    .describe("Array of document or observation IDs to fetch (1-50 IDs)"),
});
export type ContentsRequest = z.infer<typeof ContentsRequestSchema>;

export const ContentItemSchema = EventBaseSchema.extend({
  snippet: z.string(),
  content: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type ContentItem = z.infer<typeof ContentItemSchema>;

export const ContentsResponseSchema = z.object({
  data: z.object({
    items: z.array(ContentItemSchema),
    missing: z.array(z.string()),
  }),
  meta: z.object({
    total: z.number(),
  }),
  requestId: z.string(),
});
export type ContentsResponse = z.infer<typeof ContentsResponseSchema>;
