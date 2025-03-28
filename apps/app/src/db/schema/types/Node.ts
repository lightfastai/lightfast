import { z } from "zod";

import type { Texture } from "./Texture";

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

/**
 * Type for node data with optional type field
 * Used for more precise typing in getMaxTargetEdges
 */
export interface NodeData {
  type?: string;
  [key: string]: unknown;
}

// Helper function to get max edges for a node type
export const getMaxTargetEdges = (
  nodeType: NodeType,
  nodeData?: NodeData | Texture | null,
): number => {
  // Special case for texture nodes that need multiple inputs
  if (
    nodeType === "texture" &&
    nodeData &&
    typeof nodeData === "object" &&
    "type" in nodeData
  ) {
    // Check texture subtypes that need multiple inputs
    switch (nodeData.type) {
      case "Displace":
        return 2; // Source image and displacement map
      case "Add":
        return 2; // Two input textures to add together
      default:
        return 1; // Default for other texture nodes
    }
  }

  return $NodeTypeMaxTargetEdges.parse({
    geometry: 1,
    material: 0,
    texture: 1,
    flux: 0,
    window: 1,
  })[nodeType];
};
