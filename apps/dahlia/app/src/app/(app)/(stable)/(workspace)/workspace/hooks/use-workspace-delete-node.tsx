import { api } from "~/trpc/react";
import { useNodeStore } from "../providers/node-store-provider";

export const useDeleteNode = () => {
  const utils = api.useUtils();
  const { deleteNode, addNode, nodes } = useNodeStore((state) => state);
  const { mutateAsync } = api.node.delete.useMutation({
    onMutate: async ({ id }) => {
      // Find the node to delete
      const context = nodes.find((n) => n.id === id);
      if (!context) return;

      // Snapshot the previous value
      // Optimistically remove the node from the UI
      deleteNode(id);

      // IMPORTANT: We don't need to update the cache here as we allow onSettled to handle that
      // Optimistically update the cache
      // utils.node.data.get.setData({ id }, undefined);

      return context;
    },
    // onError: (err, variables, context) => {
    //   // If the mutation fails, restore the previous state
    //   if (!context) return;

    //   addNode(context);

    //   // IMPORTANT: We haven't deleted the node from the cache, as seen in onMutate,
    //   // so we don't need to update the cache here
    //   // utils.node.data.get.setData({ id: variables.id }, context);
    // },
    // onSettled: (data) => {
    //   if (!data) return;
    //   // Always invalidate queries after mutation
    //   utils.node.data.get.invalidate({ id: data.id });
    // },
  });

  return { mutateAsync };
};
