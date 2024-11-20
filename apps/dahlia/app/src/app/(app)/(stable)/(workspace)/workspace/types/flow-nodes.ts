import type { Node } from "@xyflow/react";
import type { z } from "zod";

import { type Geometry } from "@repo/db/schema";

import { $MaterialType } from "./primitives.schema";

// Extend Node type with our GeometryNode
export interface GeometryFlowNode extends Node {
  type: "geometry";
  data: Geometry;
}

export interface MaterialFlowNode extends Node {
  type: "material";
  data: {
    label: string;
    material: {
      type: z.infer<typeof $MaterialType>;
      color: string;
      shouldRenderInNode: boolean;
    };
  };
}

export type FlowNode = GeometryFlowNode | MaterialFlowNode;

// Type guards
export const isGeometryFlowNode = (node: FlowNode): node is GeometryFlowNode =>
  node.type === "geometry";

export const isMaterialFlowNode = (node: FlowNode): node is MaterialFlowNode =>
  node.type === "material";
