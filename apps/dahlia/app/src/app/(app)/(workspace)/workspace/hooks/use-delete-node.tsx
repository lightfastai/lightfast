import { $NodeType } from "@repo/db/schema";

import { api } from "~/trpc/react";
import { useTextureRenderStore } from "../providers/texture-render-store-provider";

export const useDeleteNode = () => {
  const { removeTarget } = useTextureRenderStore((state) => state);
  const utils = api.useUtils();
  const { mutateAsync } = api.node.delete.useMutation({
    onMutate: async ({ id }) => {
      // invalidate the data
      utils.node.data.get.cancel({ id });
    },
    onSuccess: (data, variables) => {
      // Clean up the render target after successful deletion
      if (data?.type === $NodeType.Enum.texture) {
        removeTarget(variables.id);
      }

      // set the data to undefined
      utils.node.data.get.setData({ id: variables.id }, undefined);
    },
  });

  return { mutateAsync };
};
