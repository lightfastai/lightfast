import { useMutation } from "@tanstack/react-query";

import { useTRPC } from "~/trpc/client/react";
import { useEdgeStore } from "../providers/edge-store-provider";

export const useDeleteEdge = () => {
  const { deleteEdge, addEdge, edges } = useEdgeStore((state) => state);
  const trpc = useTRPC();
  const { mutateAsync } = useMutation(
    trpc.tenant.edge.delete.mutationOptions({
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
    }),
  );

  return { mutateAsync };
};
