import type { Node } from "@xyflow/react";

import type { $NodeType, Geometry, NodeType } from "@repo/db/schema";
import { Material } from "@repo/db/schema";

export interface FlowNode extends Node {
  type: NodeType;
  data: Material | Geometry;
}

export interface MaterialFlowNode extends FlowNode {
  type: (typeof $NodeType)["enum"]["material"];
  data: Material;
}

export interface GeometryFlowNode extends FlowNode {
  type: (typeof $NodeType)["enum"]["geometry"];
  data: Geometry;
}
