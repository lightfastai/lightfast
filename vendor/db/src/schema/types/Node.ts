import { z } from "zod";

import type { Shaders } from "@repo/webgl";
import { getMaxTargetEdgesForShaderType } from "@repo/webgl";

import type { NodeData } from "~/schema";

export const $NodeType = z.enum([
  "geometry",
  "material",
  "texture",
  "flux",
  "window",
]);

export type NodeType = z.infer<typeof $NodeType>;

// Helper function to get max edges for a node type
export const getMaxTargetEdges = (
  nodeType: NodeType,
  nodeData: NodeData,
): number => {
  switch (nodeType) {
    case "geometry":
      return 0;
    case "material":
      return getMaxTargetEdgesForShaderType(nodeData.type as Shaders);
    case "texture":
      return 1;
    case "flux":
      return 0;
    case "window":
      return 1;
    default:
      return 0;
  }
};
