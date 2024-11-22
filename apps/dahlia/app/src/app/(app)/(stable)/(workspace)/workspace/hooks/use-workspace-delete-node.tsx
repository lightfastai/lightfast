import { api } from "~/trpc/react";
import { useNodeStore } from "../providers/node-store-provider";
import { BaseNode } from "../types/node";

interface UseWorkspaceDeleteNodeProps {
  workspaceId: string;
}

export const useWorkspaceDeleteNode = ({
  workspaceId,
}: UseWorkspaceDeleteNodeProps) => {
  const utils = api.useUtils();
  const { deleteNode } = useNodeStore((state) => state);
  const { mutate } = api.node.delete.useMutation({
    onMutate: async ({ id }) => {
      // Cancel any outgoing refetches
      await utils.node.getAllNodeIds.cancel({ workspaceId });

      // Snapshot the previous value
      const previousIds =
        utils.node.getAllNodeIds.getData({ workspaceId }) ?? [];

      // Optimistically remove the node from the UI
      deleteNode(id);

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
      console.error(err);

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

  const onNodesDelete = (nodesToDelete: BaseNode[]) => {
    const nodeIds = nodesToDelete.map((node) => node.id);

    // Delete nodes
    nodeIds.forEach((id) => {
      mutate({ id });
    });
  };

  return { onNodesDelete };
};
