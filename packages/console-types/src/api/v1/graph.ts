/**
 * /v1/graph API schemas
 *
 * Schemas for relationship graph traversal and related events.
 */

import { z } from "zod";

/**
 * Graph node - an observation in the relationship graph
 */
export const GraphNodeSchema = z.object({
  id: z.string(),
  title: z.string(),
  source: z.string(),
  type: z.string(),
  occurredAt: z.string().nullable(),
  url: z.string().nullable(),
  isRoot: z.boolean().optional(),
});

export type GraphNode = z.infer<typeof GraphNodeSchema>;

/**
 * Graph edge - a relationship between observations
 */
export const GraphEdgeSchema = z.object({
  source: z.string(),
  target: z.string(),
  type: z.string(),
  linkingKey: z.string().nullable(),
  confidence: z.number(),
});

export type GraphEdge = z.infer<typeof GraphEdgeSchema>;

/**
 * Graph API response
 */
export const GraphResponseSchema = z.object({
  data: z.object({
    root: z.object({
      id: z.string(),
      title: z.string(),
      source: z.string(),
      type: z.string(),
    }),
    nodes: z.array(GraphNodeSchema),
    edges: z.array(GraphEdgeSchema),
  }),
  meta: z.object({
    depth: z.number(),
    nodeCount: z.number(),
    edgeCount: z.number(),
    took: z.number(),
  }),
  requestId: z.string(),
});

export type GraphResponse = z.infer<typeof GraphResponseSchema>;

/**
 * Related event - an observation directly connected via relationships
 */
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

/**
 * Related events API response
 */
export const RelatedResponseSchema = z.object({
  data: z.object({
    source: z.object({
      id: z.string(),
      title: z.string(),
      source: z.string(),
    }),
    related: z.array(RelatedEventSchema),
    bySource: z.record(z.string(), z.array(RelatedEventSchema)),
  }),
  meta: z.object({
    total: z.number(),
    took: z.number(),
  }),
  requestId: z.string(),
});

export type RelatedResponse = z.infer<typeof RelatedResponseSchema>;
