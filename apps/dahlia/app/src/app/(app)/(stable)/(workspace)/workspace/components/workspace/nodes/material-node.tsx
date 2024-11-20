import { memo } from "react";
import { Handle, NodeProps, Position } from "@xyflow/react";

import type { MaterialFlowNode } from "../../../types/flow-nodes";

export const MaterialNode = memo(({ data }: NodeProps<MaterialFlowNode>) => {
  const { color, type } = data;
  return (
    <div className="material-node">
      <div>{type}</div>
      <div style={{ backgroundColor: color }}>{type}</div>
      <Handle type="source" position={Position.Right} />
      <Handle type="target" position={Position.Left} />
    </div>
  );
});
//
