import { Dispatch, SetStateAction } from "react";
import { useReactFlow } from "@xyflow/react";

import {
  $NodeType,
  createDefaultGeometry,
  createDefaultMaterial,
} from "@repo/db/schema";
import { nanoid } from "@repo/lib";

import { api } from "~/trpc/react";
import { useSelectionStore } from "../providers/selection-store-provider";
import { FlowNode } from "../types/flow-nodes";

interface UseWorkspaceAddNodeProps {
  workspaceId: string;
  setNodes: Dispatch<SetStateAction<FlowNode[]>>;
}

export const useWorkspaceAddNode = ({
  workspaceId,
  setNodes,
}: UseWorkspaceAddNodeProps) => {
  const utils = api.useUtils();
  const { selection, clearSelection } = useSelectionStore((state) => state);
  const { screenToFlowPosition } = useReactFlow();
  const create = api.node.create.useMutation({
    onMutate: async (newNode) => {
      await utils.node.getAllNodeIds.cancel({ workspaceId });

      const previousIds =
        utils.node.getAllNodeIds.getData({ workspaceId }) ?? [];

      const optimisticNode: FlowNode = {
        id: newNode.id,
        type: newNode.type,
        position: newNode.position,
        data: {},
      };

      setNodes((nodes) => nodes.concat(optimisticNode));

      utils.node.getAllNodeIds.setData({ workspaceId }, [
        ...previousIds,
        optimisticNode.id,
      ]);

      utils.node.get.setData(
        { id: optimisticNode.id },
        {
          id: optimisticNode.id,
          type: optimisticNode.type,
          position: optimisticNode.position,
        },
      );

      utils.node.getData.setData({ id: optimisticNode.id }, newNode.data);

      return { optimisticNode, previousIds };
    },

    onSuccess: (result, variables, context) => {
      if (!context) return;

      const currentIds =
        utils.node.getAllNodeIds.getData({ workspaceId }) ?? [];

      utils.node.getAllNodeIds.setData(
        { workspaceId },
        currentIds.map((id) =>
          id === context.optimisticNode.id ? result.id : id,
        ),
      );

      utils.node.get.setData(
        { id: result.id },
        {
          ...context.optimisticNode,
          id: result.id,
        },
      );

      utils.node.getData.setData({ id: result.id }, result.data);
    },

    onError: (err, newNode, context) => {
      if (!context) return;

      setNodes((nodes) =>
        nodes.filter((node) => node.id !== context.optimisticNode.id),
      );

      utils.node.getAllNodeIds.setData({ workspaceId }, context.previousIds);
      utils.node.get.setData({ id: context.optimisticNode.id }, undefined);
    },
    onSettled: (newNode) => {
      utils.node.getAllNodeIds.invalidate({ workspaceId });
      if (!newNode) return;
      utils.node.get.invalidate({ id: newNode.id });
    },
  });

  const handleCanvasClick = (event: React.MouseEvent) => {
    if (!selection) return;

    const position = screenToFlowPosition({
      x: event.clientX,
      y: event.clientY,
    });

    if (selection.type === $NodeType.enum.geometry) {
      create.mutate({
        id: nanoid(),
        workspaceId,
        type: $NodeType.enum.geometry,
        position,
        data: createDefaultGeometry({
          type: "box",
        }),
      });
    } else if (selection.type === $NodeType.enum.material) {
      create.mutate({
        id: nanoid(),
        workspaceId,
        type: $NodeType.enum.material,
        position,
        data: createDefaultMaterial({
          type: "phong",
        }),
      });
    }

    clearSelection();
  };

  return { handleCanvasClick };
};
