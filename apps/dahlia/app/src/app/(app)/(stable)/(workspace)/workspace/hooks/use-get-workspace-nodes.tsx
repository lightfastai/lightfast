import { useCallback } from "react";
import {
  addEdge,
  Connection,
  Edge,
  NodeChange,
  useEdgesState,
} from "@xyflow/react";

import { RouterInputs, RouterOutputs } from "@repo/api";

import { api } from "~/trpc/react";
import { useDebounce } from "../components/workspace/use-debounce";
import { useWorkspaceAddNode } from "../components/workspace/use-workspace-add-node";
import { useWorkspaceDeleteNode } from "../components/workspace/use-workspace-delete-node";
import { FlowNode } from "../types/flow-nodes";

interface FlowEdge extends Edge {
  sourceHandle?: string | null;
  targetHandle?: string | null;
}

interface UseGetWorkspaceNodesProps {
  workspaceId: RouterInputs["node"]["getAllNodeIds"]["workspaceId"];
}

export const useGetWorkspaceNodes = ({
  workspaceId,
}: UseGetWorkspaceNodesProps) => {
  const utils = api.useUtils();

  const [nodeIds] = api.node.getAllNodeIds.useSuspenseQuery({
    workspaceId,
  });

  const nodeQueries = api.useQueries((t) =>
    nodeIds.map((id) => t.node.get({ id, workspaceId })),
  );

  const nodes = nodeQueries
    .map((query) => query.data)
    .filter(
      (data): data is RouterOutputs["node"]["get"] =>
        data !== null && data !== undefined,
    )
    .map(
      (node): FlowNode => ({
        id: node.id,
        type: node.type,
        position: node.position,
        data: node.data,
      }),
    );

  const [edges, setEdges, onEdgesChange] = useEdgesState<FlowEdge>([]);

  const updateNodePositions = api.node.updatePositions.useMutation();

  const { onNodesDelete } = useWorkspaceDeleteNode({
    workspaceId,
    edges,
    setEdges,
    utils,
  });

  const updatePositions = useCallback(
    (nodes: FlowNode[]) => {
      const nodePositions = nodes.map((node) => ({
        id: node.id,
        position: node.position,
      }));

      updateNodePositions.mutate({
        workspaceId,
        nodes: nodePositions,
      });
    },
    [workspaceId, updateNodePositions],
  );

  const debouncedUpdatePositions = useDebounce(updatePositions, 500);

  const handleNodesChange = useCallback(
    (changes: NodeChange<FlowNode>[]) => {
      const hasPositionChanges = changes.some(
        (change): change is NodeChange<FlowNode> & { type: "position" } =>
          change.type === "position",
      );

      if (hasPositionChanges) {
        debouncedUpdatePositions(nodes);
      }
    },
    [nodes, debouncedUpdatePositions],
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((eds) => addEdge(connection, eds));
    },
    [setEdges],
  );

  const { handleCanvasClick } = useWorkspaceAddNode({
    workspaceId,
    utils,
  });

  return {
    nodes,
    edges,
    onNodesChange: handleNodesChange,
    onEdgesChange,
    onConnect,
    handleCanvasClick,
    onNodesDelete,
    isLoading: nodeQueries.some((q) => q.isLoading),
    isError: nodeQueries.some((q) => q.isError),
  };
};
