import { z } from "zod";
import { EventBaseSchema } from "./common";

export const RelatedRequestSchema = z.object({
  id: z.string(),
  depth: z.number().int().min(1).max(3).default(1),
  types: z.array(z.string()).optional(),
});
export type RelatedRequest = z.infer<typeof RelatedRequestSchema>;

export const RelatedNodeSchema = EventBaseSchema.extend({
  isRoot: z.boolean().optional(),
});
export type RelatedNode = z.infer<typeof RelatedNodeSchema>;

export const RelatedEdgeSchema = z.object({
  source: z.string(),
  target: z.string(),
  type: z.string(),
  confidence: z.number(),
});
export type RelatedEdge = z.infer<typeof RelatedEdgeSchema>;

export const RelatedResponseSchema = z.object({
  data: z.object({
    root: EventBaseSchema,
    nodes: z.array(RelatedNodeSchema),
    edges: z.array(RelatedEdgeSchema),
  }),
  meta: z.object({
    depth: z.number(),
    nodeCount: z.number(),
    edgeCount: z.number(),
  }),
  requestId: z.string(),
});
export type RelatedResponse = z.infer<typeof RelatedResponseSchema>;
