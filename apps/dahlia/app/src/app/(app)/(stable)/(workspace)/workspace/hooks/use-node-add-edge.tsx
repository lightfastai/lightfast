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

  const isEdgeValid = useCallback(
    (source: string, target: string) => {
      // check if the target node exists
      const targetNode = nodes.find((n) => n.id === target);
      if (!targetNode) return false;

      // if there already is an existing connection with the same target, return false
      if (
        edges.some((edge) => edge.source === source && edge.target === target)
      )
        return false;

      // check if the target node has reached the maximum number of incoming edges
      const maxEdges = getMaxTargetEdges(targetNode.type);
      const currentEdgeCount = edges.filter(
        (edge) => edge.target === target,
      ).length;

      // if the target node has reached the maximum number of incoming edges, return false
      if (currentEdgeCount >= maxEdges) {
        toast({
          variant: "destructive",
          description: `${targetNode.type} nodes cannot accept more than ${maxEdges} incoming connections`,
        });
        return false;
      }

      // if the edge is valid, return true
      return true;
    },
    [nodes, edges],
  );

  const onConnect = useCallback(
    async (connection: Connection) => {
      try {
        // Validate before making the API call
        if (!isEdgeValid(connection.source, connection.target)) {
          return;
        }

        // Proceed with edge creation
        await mutateAsync({
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
    [mutateAsync, isEdgeValid],
  );

  return { onConnect };
};
