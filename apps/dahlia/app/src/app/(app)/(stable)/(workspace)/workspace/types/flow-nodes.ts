import type { Node } from "@xyflow/react";

import type { NodeType } from "@repo/db/schema";

export interface FlowNode extends Node {
  id: string; // temporary unique identifier for the node
  type: NodeType;
  data: {
    dbId: string; // id of the node in the database
    workspaceId: string; // id of the workspace the node belongs to
  };
}
