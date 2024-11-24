import { useCallback } from "react";
import { Connection } from "@xyflow/react";

import { getMaxTargetEdges } from "@repo/db/schema";
import { nanoid } from "@repo/lib";
import { toast } from "@repo/ui/hooks/use-toast";

import { api } from "~/trpc/react";
import { useEdgeStore } from "../providers/edge-store-provider";
import { useNodeStore } from "../providers/node-store-provider";
import { BaseEdge } from "../types/node";

export const useNodeAddEdge = () => {
  const { edges, addEdge, deleteEdge } = useEdgeStore((state) => state);
  const { nodes } = useNodeStore((state) => state);
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
      console.error(err);
      toast({
        title: "Error",
        description: "Failed to add edge",
      });
    },
  });

  const isEdgeValid = (target: string) => {
    const targetNode = nodes.find((n) => n.id === target);
    if (!targetNode) return;
    const maxEdges = getMaxTargetEdges(targetNode.type);
    const currentEdgeCount = edges.filter(
      (edge) => edge.target === target,
    ).length;
    console.log(currentEdgeCount, maxEdges);
    if (currentEdgeCount >= maxEdges) {
      toast({
        variant: "destructive",
        description: `${targetNode.type} nodes cannot accept more than ${maxEdges} incoming connections`,
      });
      return false;
    }
    return true;
  };

  const onConnect = useCallback(
    async (connection: Connection) => {
      try {
        // Validate before making the API call
        if (!isEdgeValid(connection.target)) {
          return;
        }

        // Proceed with edge creation
        mutate({
          id: nanoid(),
          edge: {
            source: connection.source,
            target: connection.target,
          },
        });
      } catch (error) {
        // Handle error appropriately
        console.error(error);
        // Maybe show a toast notification
      }
    },
    [mutate],
  );

  return { onConnect };
};
