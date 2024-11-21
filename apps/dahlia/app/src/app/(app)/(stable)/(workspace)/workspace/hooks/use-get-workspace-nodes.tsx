import { useCallback } from "react";
import {
  addEdge,
  Connection,
  Edge,
  NodeChange,
  useEdgesState,
  useNodesState,
} from "@xyflow/react";
import { nanoid } from "nanoid";

import { RouterInputs, RouterOutputs } from "@repo/api";

import { api } from "~/trpc/react";
import { useDebounce } from "../../../../../../hooks/use-debounce";
import { FlowNode } from "../types/flow-nodes";
import { useWorkspaceAddNode } from "./use-workspace-add-node";
import { useWorkspaceDeleteNode } from "./use-workspace-delete-node";

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
          id: nanoid(),
          type: node.type,
          data: {
            dbId: node.id,
            workspaceId: workspaceId,
          },
          position: node.position,
        }),
      ),
  );

  const [edges, setEdges, onEdgesChange] = useEdgesState<FlowEdge>([]);

  const updateNodePositions = api.node.updatePositions.useMutation();

  const { onNodesDelete } = useWorkspaceDeleteNode({
    workspaceId,
    edges,
    setEdges,
    setNodes,
  });

  const updatePositions = useCallback(
    (nodes: FlowNode[]) => {
      const nodePositions = nodes.map((node) => ({
        id: node.data.dbId,
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
