import { createDefaultGeometry, createDefaultMaterial } from "@repo/db/schema";

import { api } from "~/trpc/react";
import { NetworkEditorContext } from "../../state/context";
import { FlowNode } from "../../types/flow-nodes";

interface UseWorkspaceAddNodeProps {
  workspaceId: string;
  utils: ReturnType<typeof api.useUtils>;
}

export const useWorkspaceAddNode = ({
  workspaceId,
  utils,
}: UseWorkspaceAddNodeProps) => {
  const state = NetworkEditorContext.useSelector((state) => state);

  const addNode = api.node.create.useMutation({
    onMutate: async (newNode) => {
      // Cancel any outgoing refetches
      await utils.node.getAllNodeIds.cancel({ workspaceId });

      // Get current data
      const previousIds =
        utils.node.getAllNodeIds.getData({ workspaceId }) ?? [];

      // Create optimistic node
      const optimisticNode: FlowNode = {
        id: `temp-${Date.now()}`, // Temporary ID
        type: newNode.type,
        position: newNode.position,
        data: newNode.data,
      };

      // Update getAllNodeIds cache
      utils.node.getAllNodeIds.setData({ workspaceId }, [
        ...previousIds,
        optimisticNode.id,
      ]);

      // Update individual node cache
      utils.node.get.setData(
        { id: optimisticNode.id, workspaceId },
        optimisticNode,
      );

      return { optimisticNode, previousIds };
    },

    onSuccess: (result, variables, context) => {
      if (!context) return;

      // Get current nodeIds
      const currentIds =
        utils.node.getAllNodeIds.getData({ workspaceId }) ?? [];

      // Replace temp id with real id in nodeIds list
      utils.node.getAllNodeIds.setData(
        { workspaceId },
        currentIds.map((id) =>
          id === context.optimisticNode.id ? result.id : id,
        ),
      );

      // Update the node's ID and data
      const optimisticNode = utils.node.get.getData({
        id: context.optimisticNode.id,
        workspaceId,
      });

      if (optimisticNode) {
        // Set the node with the new ID
        utils.node.get.setData(
          { id: result.id, workspaceId },
          {
            ...optimisticNode,
            id: result.id,
            data: result.data,
          },
        );
      }
    },

    onError: (err, newNode, context) => {
      if (!context) return;

      // Rollback on error
      utils.node.getAllNodeIds.setData({ workspaceId }, context.previousIds);
      utils.node.get.setData(
        { id: context.optimisticNode.id, workspaceId },
        undefined,
      );
    },
    onSettled: (newNode) => {
      utils.node.getAllNodeIds.invalidate({ workspaceId });
      if (!newNode) return;
      utils.node.get.invalidate({ id: newNode.id, workspaceId });
    },
  });

  const handleCanvasClick = (event: React.MouseEvent) => {
    if (state.context.selectedGeometry) {
      addNode.mutate({
        workspaceId,
        type: "geometry",
        position: { x: event.clientX, y: event.clientY },
        data: createDefaultGeometry({
          type: state.context.selectedGeometry,
        }),
      });
    } else if (state.context.selectedMaterial) {
      addNode.mutate({
        workspaceId,
        type: "material",
        position: { x: event.clientX, y: event.clientY },
        data: createDefaultMaterial({
          type: state.context.selectedMaterial,
        }),
      });
    }
  };

  return { handleCanvasClick };
};
