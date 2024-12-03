import { useCallback } from "react";
import { Connection } from "@xyflow/react";

import { nanoid } from "@repo/lib";
import { toast } from "@repo/ui/hooks/use-toast";

import { api } from "~/trpc/react";
import { useEdgeStore } from "../providers/edge-store-provider";
import { BaseEdge } from "../types/node";
import { useEdgeValidation } from "./use-validate-edge";

export const useAddEdge = () => {
  const { addEdge, deleteEdge } = useEdgeStore((state) => state);
  const { mutateAsync: mut } = api.tenant.edge.create.useMutation({
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

  const {
    validateSelfConnection,
    validateTargetExistence,
    validateMaxIncomingEdges,
  } = useEdgeValidation();

  const mutateAsync = useCallback(
    async (connection: Connection) => {
      const { source, target } = connection;

      // Perform shared validations
      if (
        !validateSelfConnection(source, target) ||
        !validateTargetExistence(target) ||
        !validateMaxIncomingEdges(target)
      ) {
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
      validateSelfConnection,
      validateTargetExistence,
      validateMaxIncomingEdges,
      mut,
    ],
  );

  return { mutateAsync };
};
