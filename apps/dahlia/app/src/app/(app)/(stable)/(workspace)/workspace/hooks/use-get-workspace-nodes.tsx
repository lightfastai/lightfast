import { useCallback } from "react";
import {
  addEdge,
  Connection,
  Edge,
  NodeChange,
  useEdgesState,
  useNodesState,
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
  initialNodeIds: string[];
}

export const useGetWorkspaceNodes = ({
  workspaceId,
  initialNodeIds,
}: UseGetWorkspaceNodesProps) => {
  const utils = api.useUtils();

  const { data: nodeIds } = api.node.getAllNodeIds.useQuery(
    {
      workspaceId,
    },
    {
      initialData: initialNodeIds,
    },
  );

  const [nodeQueries] = api.useSuspenseQueries((t) =>
    nodeIds.map((id) => t.node.get({ id, workspaceId })),
  );

  const [nodes, setNodes, onNodesChange] = useNodesState<FlowNode>(
    nodeQueries
      .map((query) => query)
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
      ),
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

  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((eds) => addEdge(connection, eds));
    },
    [setEdges],
  );

  const { handleCanvasClick } = useWorkspaceAddNode({
    workspaceId,
    setNodes,
  });

  return {
    nodes,
    edges,
    onNodesChange: handleNodesChange,
    onEdgesChange,
    onConnect,
    handleCanvasClick,
    onNodesDelete,
  };
};
