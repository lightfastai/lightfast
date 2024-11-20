import type { Node } from "@xyflow/react";

import type { Geometry } from "@repo/db/schema";
import { Material } from "@repo/db/schema";

export interface FlowNode extends Node {
  type: NodeType;
  data: Material | Geometry;
}
