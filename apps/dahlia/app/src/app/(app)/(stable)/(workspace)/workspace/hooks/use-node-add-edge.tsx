import { useCallback } from "react";
import { Connection } from "@xyflow/react";

import { nanoid } from "@repo/lib";

import { api } from "~/trpc/react";
import { useEdgeStore } from "../providers/edge-store-provider";
import { BaseEdge } from "../types/node";

export const useNodeAddEdge = () => {
  const { addEdge, deleteEdge } = useEdgeStore((state) => state);
  const { mutate } = api.edge.addEdge.useMutation({
    onMutate: async (newEdge) => {
      const optimisticEdge: BaseEdge = {
        id: newEdge.id,
        source: newEdge.edge.source,
        target: newEdge.edge.target,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      addEdge(optimisticEdge);

      return { optimisticEdge };
    },
    onError: (err, newEdge, context) => {
      if (!context) return;
      deleteEdge(context.optimisticEdge.id);
    },
  });

  const onConnect = useCallback(
    (connection: Connection) => {
      // Then send to the server
      mutate({
        id: nanoid(),
        edge: { source: connection.source, target: connection.target },
      });
    },
    [addEdge, mutate],
  );

  return { onConnect };
};
