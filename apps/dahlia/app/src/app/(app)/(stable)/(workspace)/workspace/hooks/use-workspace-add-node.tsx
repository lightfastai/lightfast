import { useReactFlow } from "@xyflow/react";

import {
  $GeometryType,
  $MaterialType,
  $NodeType,
  createDefaultGeometry,
  createDefaultMaterial,
  Geometry,
  GeometryType,
  Material,
  MaterialType,
} from "@repo/db/schema";
import { nanoid } from "@repo/lib";

import { api } from "~/trpc/react";
import { useNodeStore } from "../providers/node-store-provider";
import { useSelectionStore } from "../providers/selection-store-provider";
import { BaseNode } from "../types/node";

interface UseWorkspaceAddNodeProps {
  workspaceId: string;
}

export const useWorkspaceAddNode = ({
  workspaceId,
}: UseWorkspaceAddNodeProps) => {
  const utils = api.useUtils();
  const { addNode, deleteNode } = useNodeStore((state) => state);
  const { selection, clearSelection } = useSelectionStore((state) => state);
  const { screenToFlowPosition } = useReactFlow();
  const create = api.node.create.useMutation({
    onMutate: async (newNode) => {
      await utils.node.getAllNodeIds.cancel({ workspaceId });

      const previousIds =
        utils.node.getAllNodeIds.getData({ workspaceId }) ?? [];

      const optimisticNode: BaseNode = {
        id: newNode.id,
        type: newNode.type,
        position: newNode.position,
        data: {},
      };

      addNode(optimisticNode);

      utils.node.getAllNodeIds.setData({ workspaceId }, [
        ...previousIds,
        optimisticNode,
      ]);

      utils.node.get.setData(
        { id: optimisticNode.id },
        {
          id: optimisticNode.id,
          type: optimisticNode.type,
          position: optimisticNode.position,
        },
      );

      utils.node.getData.setData(
        { id: optimisticNode.id },
        newNode.data as Geometry | Material,
      );

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

      deleteNode(context.optimisticNode.id);

      utils.node.getAllNodeIds.setData({ workspaceId }, context.previousIds);
      utils.node.get.setData({ id: context.optimisticNode.id }, undefined);
    },
    onSettled: (newNode) => {
      utils.node.getAllNodeIds.invalidate({ workspaceId });
      if (!newNode) return;
      utils.node.get.invalidate({ id: newNode.id });
    },
  });

  const onClick = (event: React.MouseEvent) => {
    if (!selection) return;

    const position = screenToFlowPosition({
      x: event.clientX,
      y: event.clientY,
    });

    if (
      selection.type === $NodeType.enum.geometry &&
      $GeometryType.safeParse(selection.value).success
    ) {
      create.mutate({
        id: nanoid(),
        workspaceId,
        type: $NodeType.enum.geometry,
        position,
        data: createDefaultGeometry({
          type: selection.value as GeometryType,
        }),
      });
    } else if (
      selection.type === $NodeType.enum.material &&
      $MaterialType.safeParse(selection.value).success
    ) {
      create.mutate({
        id: nanoid(),
        workspaceId,
        type: $NodeType.enum.material,
        position,
        data: createDefaultMaterial({
          type: selection.value as MaterialType,
        }),
      });
    }

    clearSelection();
  };

  return { onClick };
};
