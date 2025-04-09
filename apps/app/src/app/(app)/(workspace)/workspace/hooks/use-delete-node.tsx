import { useMutation, useQueryClient } from "@tanstack/react-query";

import { $NodeType } from "@vendor/db/types";

import { useTRPC } from "~/trpc/client/react";
import { useTextureRenderStore } from "../providers/texture-render-store-provider";

export const useDeleteNode = () => {
  const { removeTarget } = useTextureRenderStore((state) => state);
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { mutateAsync } = useMutation(
    trpc.tenant.node.delete.mutationOptions({
      onMutate: async ({ id }) => {
        // invalidate the data
        await queryClient.cancelQueries(
          trpc.tenant.node.data.get.queryFilter({ id }),
        );
      },
      onSuccess: (data, variables) => {
        // Clean up the render target after successful deletion
        if (data.type === $NodeType.Enum.texture) {
          removeTarget(variables.id);
        }

        // set the data to undefined
        queryClient.setQueryData(
          [trpc.tenant.node.data.get.queryFilter({ id: variables.id })],
          undefined,
        );
      },
    }),
  );

  return { mutateAsync };
};
