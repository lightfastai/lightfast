import { Dispatch, SetStateAction } from "react";
import { Edge } from "@xyflow/react";

import { api } from "~/trpc/react";
import { FlowNode } from "../types/flow-nodes";

interface UseWorkspaceDeleteNodeProps {
  workspaceId: string;
  edges: Edge[];
  setEdges: (edges: Edge[] | ((edges: Edge[]) => Edge[])) => void;
  setNodes: Dispatch<SetStateAction<FlowNode[]>>;
}

export const useWorkspaceDeleteNode = ({
  workspaceId,
  edges,
  setEdges,
  setNodes,
}: UseWorkspaceDeleteNodeProps) => {
  const utils = api.useUtils();
  const { mutate } = api.node.delete.useMutation({
    onMutate: async ({ id }) => {
      // Cancel any outgoing refetches
      await utils.node.getAllNodeIds.cancel({ workspaceId });

      // Snapshot the previous value
      const previousIds =
        utils.node.getAllNodeIds.getData({ workspaceId }) ?? [];

      // Optimistically remove the node from the UI
      setNodes((nodes) => nodes.filter((node) => node.data.dbId !== id));

      // Optimistically update the cache
      utils.node.getAllNodeIds.setData(
        { workspaceId },
        previousIds.filter((nodeId) => nodeId !== id),
      );

      // Remove the node data from the cache
      utils.node.get.setData({ id }, undefined);

      return { previousIds };
    },
    onError: (err, { id }, context) => {
      // If the mutation fails, restore the previous state
      if (!context) return;

      utils.node.getAllNodeIds.setData({ workspaceId }, context.previousIds);

      // Refetch to ensure consistency
      utils.node.getAllNodeIds.invalidate({ workspaceId });
      utils.node.get.invalidate({ id });
    },
    onSettled: () => {
      // Always invalidate queries after mutation
      utils.node.getAllNodeIds.invalidate({ workspaceId });
    },
  });

  const onNodesDelete = (nodesToDelete: FlowNode[]) => {
    const nodeIds = nodesToDelete.map((node) => node.id);

    // Remove connected edges
    setEdges(
      edges.filter(
        (edge) =>
          !nodeIds.includes(edge.source) && !nodeIds.includes(edge.target),
      ),
    );

    // Delete nodes
    nodeIds.forEach((id) => {
      mutate({ id });
    });
  };

  return { onNodesDelete };
};
