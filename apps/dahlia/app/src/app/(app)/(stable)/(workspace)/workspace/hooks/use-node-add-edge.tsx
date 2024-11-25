import { useCallback } from "react";
import { Connection } from "@xyflow/react";

import { getMaxTargetEdges } from "@repo/db/schema";
import { nanoid } from "@repo/lib";
import { toast } from "@repo/ui/hooks/use-toast";

import { api } from "~/trpc/react";
import { useEdgeStore } from "../providers/edge-store-provider";
import { useNodeStore } from "../providers/node-store-provider";
import { BaseEdge } from "../types/node";
import { useAddEdge } from "./use-add-edge";

export const useNodeAddEdge = () => {
  const { edges, addEdge, deleteEdge } = useEdgeStore((state) => state);
  const { nodes } = useNodeStore((state) => state);
  const { mutateAsync: addEdgeMutation } = useAddEdge();

  const replaceEdgeMutation = api.edge.replaceEdge.useMutation({
    onMutate: async ({ oldEdgeId, newEdge }) => {
      const optimisticEdge: BaseEdge = {
        id: newEdge.id,
        source: newEdge.source,
        target: newEdge.target,
      };
      const oldEdge = edges.find((e) => e.id === oldEdgeId);
      if (oldEdge) {
        deleteEdge(oldEdgeId);
      }
      addEdge(optimisticEdge);

      return { optimisticEdge, oldEdge };
    },
    onError: (err, vars, context) => {
      if (!context) return;
      deleteEdge(context.optimisticEdge.id);
      if (context.oldEdge) {
        addEdge(context.oldEdge);
      }
      console.error(err);
      toast({
        title: "Error",
        description: "Failed to replace edge",
      });
    },
  });

  const isEdgeValid = useCallback(
    (source: string, target: string) => {
      // check if the target node exists
      const targetNode = nodes.find((n) => n.id === target);
      if (!targetNode) return false;

      // Get the maximum allowed edges for this node type
      const maxEdges = getMaxTargetEdges(targetNode.type);
      const currentEdgeCount = edges.filter(
        (edge) => edge.target === target,
      ).length;

      // if the target node has reached the maximum number of incoming edges
      // and there's no existing connection to replace, return false
      const existingEdge = edges.find(
        (edge) => edge.target === target && edge.source === source,
      );
      const hasExistingConnection = edges.some(
        (edge) => edge.target === target,
      );

      if (currentEdgeCount >= maxEdges && !hasExistingConnection) {
        toast({
          variant: "destructive",
          description: `${targetNode.type} nodes cannot accept more than ${maxEdges} incoming connections`,
        });
        return false;
      }

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

        // Check if there's an existing edge to the target
        const existingEdge = edges.find(
          (edge) => edge.target === connection.target,
        );

        if (existingEdge) {
          // Replace the existing edge
          await replaceEdgeMutation.mutateAsync({
            oldEdgeId: existingEdge.id,
            newEdge: {
              id: nanoid(),
              source: connection.source,
              target: connection.target,
            },
          });
        } else {
          // Create a new edge
          await addEdgeMutation({
            id: nanoid(),
            edge: {
              source: connection.source,
              target: connection.target,
            },
          });
        }
      } catch (error) {
        console.error(error);
      }
    },
    [addEdgeMutation, replaceEdgeMutation, edges, isEdgeValid],
  );

  return { onConnect };
};
