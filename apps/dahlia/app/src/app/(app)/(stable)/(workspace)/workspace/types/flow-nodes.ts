import type { Node } from "@xyflow/react";
import type { z } from "zod";

import { $Geometry } from "@repo/db/schema";

import { $MaterialType } from "./primitives.schema";

// Extend Node type with our GeometryNode
export type GeometryFlowNode = z.infer<typeof $Geometry> & Node;

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

// Default values aligned with schema types
export const DEFAULT_GEOMETRY_NODE: Omit<GeometryFlowNode, "id" | "position"> =
  {
    type: "geometry",
    data: {
      label: "New Geometry",
      geometry: {
        type: "box",
        position: { x: 0, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 1 },
        rotation: { x: 0, y: 0, z: 0 },
        wireframe: false,
        shouldRenderInNode: true,
      },
    },
  };

export const DEFAULT_MATERIAL_NODE: Omit<MaterialFlowNode, "id" | "position"> =
  {
    type: "material",
    data: {
      label: "New Material",
      material: {
        type: "Phong",
        color: "#ffffff",
        shouldRenderInNode: true,
      },
    },
  };

// Helper type for node data
export type GeometryNodeData = GeometryFlowNode["data"];
export type MaterialNodeData = MaterialFlowNode["data"];

// Helper functions for creating nodes
export const createGeometryNode = (
  id: string,
  position: { x: number; y: number },
  data?: Partial<GeometryNodeData>,
): GeometryFlowNode => ({
  ...DEFAULT_GEOMETRY_NODE,
  id,
  position,
  data: {
    ...DEFAULT_GEOMETRY_NODE.data,
    ...data,
  },
});

export const createMaterialNode = (
  id: string,
  position: { x: number; y: number },
  data?: Partial<MaterialNodeData>,
): MaterialFlowNode => ({
  ...DEFAULT_MATERIAL_NODE,
  id,
  position,
  data: {
    ...DEFAULT_MATERIAL_NODE.data,
    ...data,
  },
});
