import { useCallback } from "react";
import { Edge } from "@xyflow/react";

import { api } from "~/trpc/react";
import { useEdgeStore } from "../providers/edge-store-provider";

export const useWorkspaceDeleteEdge = () => {
  const { deleteEdge, addEdge, edges } = useEdgeStore((state) => state);
  const { mutateAsync } = api.edge.deleteEdge.useMutation({
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
  const onEdgesDelete = useCallback(
    (edges: Edge[]) => {
      edges.forEach((edge) => {
        mutateAsync({ id: edge.id });
      });
    },
    [mutateAsync],
  );

  return { onEdgesDelete };
};
