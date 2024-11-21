import type { Node } from "@xyflow/react";

import type { $NodeType, Geometry, NodeType } from "@repo/db/schema";
import { Material } from "@repo/db/schema";

export interface FlowNode extends Node {
  type: NodeType;
  data: {
    id: string;
    data: Material | Geometry;
  };
}

export interface MaterialFlowNode extends FlowNode {
  type: (typeof $NodeType)["enum"]["material"];
  data: {
    id: string;
    data: Material;
  };
}

export interface GeometryFlowNode extends FlowNode {
  type: (typeof $NodeType)["enum"]["geometry"];
  data: {
    id: string;
    data: Geometry;
  };
}
