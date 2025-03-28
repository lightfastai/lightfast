import { z } from "zod";

export const $NodeType = z.enum([
  "geometry",
  "material",
  "texture",
  "flux",
  "window",
]);

export type NodeType = z.infer<typeof $NodeType>;

// Define the mapping of node types to their maximum allowed source edges
export const $NodeTypeMaxTargetEdges = z.object({
  geometry: z.literal(1),
  material: z.literal(0),
  texture: z.literal(1),
  flux: z.literal(0),
  window: z.literal(1),
}) satisfies z.ZodType<Record<NodeType, number>>;

export type NodeTypeMaxTargetEdges = z.infer<typeof $NodeTypeMaxTargetEdges>;

// Helper function to get max edges for a node type
export const getMaxTargetEdges = (nodeType: NodeType): number => {
  return $NodeTypeMaxTargetEdges.parse({
    geometry: 1,
    material: 0,
    texture: 1,
    flux: 0,
    window: 1,
  })[nodeType];
};
