import { toast } from "@repo/ui/hooks/use-toast";

import { api } from "~/trpc/react";
import { useEdgeStore } from "../providers/edge-store-provider";
import { BaseEdge } from "../types/node";

export const useAddEdge = () => {
  const { addEdge, deleteEdge } = useEdgeStore((state) => state);
  const { mutateAsync } = api.edge.addEdge.useMutation({
    onMutate: async (newEdge) => {
      const optimisticEdge: BaseEdge = {
        id: newEdge.id,
        source: newEdge.edge.source,
        target: newEdge.edge.target,
      };

      addEdge(optimisticEdge);

      return { optimisticEdge };
    },
    onError: (err, newEdge, context) => {
      if (!context) return;
      deleteEdge(context.optimisticEdge.id);
      console.error(err);
      toast({
        title: "Error",
        description: "Failed to add edge",
      });
    },
  });

  return { mutateAsync };
};
