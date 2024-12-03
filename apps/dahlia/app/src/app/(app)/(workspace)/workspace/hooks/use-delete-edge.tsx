import { api } from "~/trpc/react";
import { useEdgeStore } from "../providers/edge-store-provider";

export const useDeleteEdge = () => {
  const { deleteEdge, addEdge, edges } = useEdgeStore((state) => state);
  const { mutateAsync } = api.tenant.edgedeleteEdge.useMutation({
    onMutate: (id) => {
      const edge = edges.find((e) => e.id === id.id);
      if (!edge) return;

      deleteEdge(edge.id);

      return { edge };
    },
    onError: (err, id, context) => {
      if (!context) return;
      console.error(err);
      addEdge(context.edge);
    },
  });

  return { mutateAsync };
};
