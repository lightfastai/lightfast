import type { Node } from "@xyflow/react";

import type { NodeType } from "@repo/db/schema";

export interface FlowNode extends Node {
  type: NodeType;
  data: {
    dbId: string;
    workspaceId: string;
  };
}
