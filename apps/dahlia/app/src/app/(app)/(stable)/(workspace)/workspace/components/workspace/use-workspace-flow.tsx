import type { Edge } from "@xyflow/react";
import { useCallback, useEffect } from "react";
import {
  addEdge,
  Connection,
  useEdgesState,
  useNodesState,
} from "@xyflow/react";

import { FlowNode } from "../../types/flow-nodes";
import { useWorkspaceAddNode } from "./use-workspace-add-node";

interface FlowEdge extends Edge {
  sourceHandle?: string | null;
  targetHandle?: string | null;
}

interface UseWorkspaceFlowProps {
  initialNodes?: FlowNode[];
}

export function useWorkspaceFlow({ initialNodes = [] }: UseWorkspaceFlowProps) {
  const [nodes, setNodes, onNodesChange] =
    useNodesState<FlowNode>(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<FlowEdge>([]);

  // Initialize nodes
  useEffect(() => {
    if (initialNodes.length > 0) {
      setNodes(initialNodes);
    }
  }, [initialNodes, setNodes]);

  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((eds) => addEdge(connection, eds));
    },
    [setEdges],
  );

  const { handleCanvasClick } = useWorkspaceAddNode({ setNodes });

  return {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    handleCanvasClick,
  };
}
