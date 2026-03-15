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
  linkingKey: z.string().nullable(),
  confidence: z.number(),
});
export type RelatedEdge = z.infer<typeof RelatedEdgeSchema>;

export const RelatedEventSchema = z.object({
  id: z.string(),
  title: z.string(),
  source: z.string(),
  type: z.string(),
  occurredAt: z.string().nullable(),
  url: z.string().nullable(),
  relationshipType: z.string(),
  direction: z.enum(["outgoing", "incoming"]),
});
export type RelatedEvent = z.infer<typeof RelatedEventSchema>;

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
    took: z.number(),
  }),
  requestId: z.string(),
});
export type RelatedResponse = z.infer<typeof RelatedResponseSchema>;
