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
        updatedAt: null,
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
      const newEdge = {
        id: nanoid(),
        source: connection.source,
        target: connection.target,
      };

      // Then send to the server
      mutate({ id: newEdge.id, edge: connection });
    },
    [addEdge, mutate],
  );

  return { onConnect };
};
