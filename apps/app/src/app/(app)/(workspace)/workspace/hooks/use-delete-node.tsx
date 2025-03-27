import { $NodeType } from "@dahlia/db/tenant/schema";

import { api } from "~/trpc/client/react";
import { useTextureRenderStore } from "../providers/texture-render-store-provider";

export const useDeleteNode = () => {
  const { removeTarget } = useTextureRenderStore((state) => state);
  const utils = api.useUtils();
  const { mutateAsync } = api.tenant.node.delete.useMutation({
    onMutate: async ({ id }) => {
      // invalidate the data
      utils.tenant.node.data.get.cancel({ id });
    },
    onSuccess: (data, variables) => {
      // Clean up the render target after successful deletion
      if (data.type === $NodeType.Enum.texture) {
        removeTarget(variables.id);
      }

      // set the data to undefined
      utils.tenant.node.data.get.setData({ id: variables.id }, undefined);
    },
  });

  return { mutateAsync };
};
