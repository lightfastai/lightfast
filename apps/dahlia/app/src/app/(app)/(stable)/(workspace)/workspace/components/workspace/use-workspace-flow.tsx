import type { Edge, NodeChange } from "@xyflow/react";
import { useCallback, useEffect } from "react";
import {
  addEdge,
  Connection,
  useEdgesState,
  useNodesState,
} from "@xyflow/react";

import { api } from "~/trpc/react";
import { FlowNode } from "../../types/flow-nodes";
import { useDebounce } from "./use-debounce";
import { useWorkspaceAddNode } from "./use-workspace-add-node";

interface FlowEdge extends Edge {
  sourceHandle?: string | null;
  targetHandle?: string | null;
}

interface UseWorkspaceFlowProps {
  initialNodes?: FlowNode[];
  workspaceId: string;
}

export function useWorkspaceFlow({
  initialNodes = [],
  workspaceId,
}: UseWorkspaceFlowProps) {
  const [nodes, setNodes, onNodesChange] =
    useNodesState<FlowNode>(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<FlowEdge>([]);

  const updateNodePositions = api.workspace.updateNodePositions.useMutation();

  const updatePositions = useCallback(
    (nodes: FlowNode[]) => {
      const nodePositions = nodes.map((node) => ({
        id: node.id,
        position: node.position,
      }));

      updateNodePositions.mutate({
        id: workspaceId,
        nodes: nodePositions,
      });
    },
    [workspaceId, updateNodePositions],
  );

  const debouncedUpdatePositions = useDebounce(updatePositions, 500);

  const handleNodesChange = useCallback(
    (changes: NodeChange<FlowNode>[]) => {
      onNodesChange(changes);

      const hasPositionChanges = changes.some(
        (change): change is NodeChange<FlowNode> & { type: "position" } =>
          change.type === "position",
      );

      if (hasPositionChanges) {
        debouncedUpdatePositions(nodes);
      }
    },
    [nodes, debouncedUpdatePositions, onNodesChange],
  );

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

  const { handleCanvasClick } = useWorkspaceAddNode({
    setNodes,
    workspaceId,
  });

  return {
    nodes,
    edges,
    onNodesChange: handleNodesChange,
    onEdgesChange,
    onConnect,
    handleCanvasClick,
  };
}
