import { useCallback } from "react";
import { Connection } from "@xyflow/react";

import { getMaxTargetEdges, NodeType } from "@repo/db/schema";
import { nanoid } from "@repo/lib";
import { toast } from "@repo/ui/hooks/use-toast";

import { createValidator } from "~/hooks/use-validator";
import { api } from "~/trpc/react";
import { useEdgeStore } from "../providers/edge-store-provider";
import { useNodeStore } from "../providers/node-store-provider";
import { BaseEdge, BaseNode } from "../types/node";

export const useAddEdge = () => {
  const { edges, addEdge, deleteEdge } = useEdgeStore((state) => state);
  const { nodes } = useNodeStore((state) => state);

  const { mutateAsync: mut } = api.edge.addEdge.useMutation({
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

  // Memoize helper functions to prevent unnecessary re-creations
  const isSelfConnection = useCallback(
    createValidator((source: string, target: string) => source !== target),
    [],
  );

  const doesTargetNodeExist = useCallback(
    createValidator(
      (target: string, nodes: BaseNode[]) =>
        !!nodes.find((n) => n.id === target),
    ),
    [nodes],
  );

  const hasExceededMaxIncomingEdges = useCallback(
    createValidator(
      (target: string, targetNodeType: NodeType, edges: BaseEdge[]) => {
        const maxEdges = getMaxTargetEdges(targetNodeType);
        const currentEdgeCount = edges.filter(
          (edge) => edge.target === target,
        ).length;
        return currentEdgeCount < maxEdges;
      },
    ),
    [edges],
  );

  const mutateAsync = useCallback(
    async (connection: Connection, edges: BaseEdge[], nodes: BaseNode[]) => {
      const { source, target } = connection;

      // Perform self-connection validation
      if (!isSelfConnection(source, target)) {
        toast({
          variant: "destructive",
          description: "A node cannot connect to itself.",
        });
        return;
      }

      // Perform target node existence validation
      if (!doesTargetNodeExist(target, nodes)) {
        toast({
          variant: "destructive",
          description: "Target node does not exist.",
        });
        return;
      }

      const targetNode = nodes.find((n) => n.id === target);
      if (!targetNode) return; // Type safety

      // Perform maximum incoming edges validation
      if (!hasExceededMaxIncomingEdges(target, targetNode.type, edges)) {
        const maxEdges = getMaxTargetEdges(targetNode.type);
        toast({
          variant: "destructive",
          description: `${targetNode.type} nodes cannot accept more than ${maxEdges} incoming connections.`,
        });
        return;
      }

      // Directly add a new edge without replacing existing ones
      try {
        await mut({
          id: nanoid(),
          edge: {
            source: connection.source,
            target: connection.target,
          },
        });
      } catch (error) {
        console.error(error);
        // Optionally, handle additional error scenarios here
      }
    },
    [
      nodes,
      edges,
      isSelfConnection,
      doesTargetNodeExist,
      hasExceededMaxIncomingEdges,
      mut,
    ],
  );

  return { mutateAsync };
};
