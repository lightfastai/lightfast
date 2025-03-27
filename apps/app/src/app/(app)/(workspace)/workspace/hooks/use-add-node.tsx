import { useReactFlow } from "@xyflow/react";

import type {
  Geometry,
  GeometryType,
  Material,
  MaterialType,
  Texture,
  TextureType,
  Txt2ImgType,
} from "@dahlia/db/tenant/schema";
import {
  $GeometryType,
  $MaterialType,
  $NodeType,
  $TextureTypes,
  createDefaultGeometry,
  createDefaultMaterial,
  createDefaultTexture,
  createDefaultTxt2Img,
} from "@dahlia/db/tenant/schema";
import { nanoid } from "@repo/lib";

import type { BaseNode } from "../types/node";
import { api } from "~/trpc/client/react";
import { useNodeStore } from "../providers/node-store-provider";
import { useSelectionStore } from "../providers/selection-store-provider";
import { useTextureRenderStore } from "../providers/texture-render-store-provider";

interface UseWorkspaceAddNodeProps {
  workspaceId: string;
}

export const useAddNode = ({ workspaceId }: UseWorkspaceAddNodeProps) => {
  const utils = api.useUtils();
  const { addNode, deleteNode } = useNodeStore((state) => state);
  const { addTarget } = useTextureRenderStore((state) => state);
  const { selection, clearSelection } = useSelectionStore((state) => state);
  const { screenToFlowPosition } = useReactFlow();
  const create = api.tenant.node.create.useMutation({
    onMutate: async (newNode) => {
      // Cancel any outgoing refetches
      await utils.tenant.node.data.get.cancel({ id: newNode.id });

      const optimisticNode: BaseNode = {
        id: newNode.id,
        type: newNode.type,
        position: newNode.position,
        data: {},
      };

      addNode(optimisticNode);

      utils.tenant.node.data.get.setData(
        { id: newNode.id },
        newNode.data as Geometry | Material | Texture,
      );

      if (newNode.type === $NodeType.Enum.texture) {
        addTarget(newNode.id);
      }

      return { optimisticNode };
    },

    onError: (err, newNode, context) => {
      if (!context) return;
      console.error(err);

      deleteNode(context.optimisticNode.id);

      utils.tenant.node.data.get.setData({ id: newNode.id }, undefined);
    },
    onSettled: (newNode) => {
      if (!newNode) return;
      utils.tenant.node.data.get.invalidate({ id: newNode.id });
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
    } else if (
      selection.type === $NodeType.enum.texture &&
      $TextureTypes.safeParse(selection.value).success
    ) {
      create.mutate({
        id: nanoid(),
        workspaceId,
        type: $NodeType.enum.texture,
        position,
        data: createDefaultTexture({
          type: selection.value as TextureType,
        }),
      });
    } else if (selection.type === $NodeType.enum.flux) {
      create.mutate({
        id: nanoid(),
        workspaceId,
        type: $NodeType.enum.flux,
        position,
        data: createDefaultTxt2Img({ type: selection.value as Txt2ImgType }),
      });
    }

    clearSelection();
  };

  return { onClick };
};
