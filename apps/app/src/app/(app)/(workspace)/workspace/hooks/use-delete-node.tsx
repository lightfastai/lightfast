"use client";

import { $NodeType } from "@vendor/db/lightfast/types";

import { api } from "~/trpc/client/react";
import { useTextureRenderStore } from "../providers/texture-render-store-provider";

export const useDeleteNode = () => {
  const { removeTarget } = useTextureRenderStore((state) => state);
  const utils = api.useUtils();
  const { mutateAsync } = api.tenant.node.delete.useMutation({
    onMutate: async ({ nodeId }) => {
      // invalidate the data
      await utils.tenant.node.data.get.cancel({ nodeId });
    },
    onSuccess: (data, variables) => {
      // Clean up the render target after successful deletion
      if (data?.type === $NodeType.enum.texture) {
        removeTarget(variables.nodeId);
      }

      // set the data to undefined
      utils.tenant.node.data.get.setData(
        { nodeId: variables.nodeId },
        undefined,
      );
    },
  });

  return { mutateAsync };
};
