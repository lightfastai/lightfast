import { z } from "zod";
import { EventBaseSchema } from "./common";

export const ContentsRequestSchema = z.object({
  ids: z.array(z.string()).min(1).max(50),
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
