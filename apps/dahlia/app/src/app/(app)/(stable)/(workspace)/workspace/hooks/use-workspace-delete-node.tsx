import { api } from "~/trpc/react";
import { useEdgeStore } from "../providers/edge-store-provider";
import { useNodeStore } from "../providers/node-store-provider";

export const useDeleteNode = () => {
  const utils = api.useUtils();
  const { deleteNode, addNode, nodes } = useNodeStore((state) => state);
  const { deleteEdge, addEdge, edges } = useEdgeStore((state) => state);
  const { mutateAsync } = api.node.delete.useMutation({
    onMutate: async ({ id }) => {
      // Find the node to delete
      const context = nodes.find((n) => n.id === id);
      if (!context) return;

      // Identify all edges connected to the node
      const connectedEdges = edges.filter(
        (edge) => edge.source === id || edge.target === id,
      );

      // Optimistically remove the node
      deleteNode(id);

      // Optimistically remove all connected edges
      connectedEdges.forEach((edge) => deleteEdge(edge.id));

      return { node: context, edges: connectedEdges }; // Return context for rollback
    },
    onError: (err, variables, context) => {
      if (!context) return;

      // Restore the deleted node
      addNode(context.node);

      // Restore all connected edges
      context.edges.forEach((edge) => addEdge(edge));

      console.error("Failed to delete node and its edges:", err);
    },
    // onSettled: (data) => {
    //   if (!data) return;
    //   // Always invalidate queries after mutation
    //   utils.node.data.get.invalidate({ id: data.id });
    // },
  });

  return { mutateAsync };
};
