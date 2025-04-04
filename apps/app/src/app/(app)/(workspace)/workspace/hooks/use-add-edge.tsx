import type { Connection } from "@xyflow/react";
import { useCallback } from "react";

import { nanoid } from "@repo/lib";
import { toast } from "@repo/ui/hooks/use-toast";

import type { BaseEdge } from "../types/node";
import { api } from "~/trpc/client/react";
import { useEdgeStore } from "../providers/edge-store-provider";
import { useConnectionValidation } from "./use-connection-validation";

export const useAddEdge = () => {
  const { addEdge, deleteEdge } = useEdgeStore((state) => state);
  const { validateConnection } = useConnectionValidation();

  const { mutateAsync: mut } = api.tenant.edge.create.useMutation({
    onMutate: (newEdge) => {
      const optimisticEdge: BaseEdge = {
        id: newEdge.id,
        source: newEdge.edge.source,
        target: newEdge.edge.target,
        sourceHandle: newEdge.edge.sourceHandle,
        targetHandle: newEdge.edge.targetHandle,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      addEdge(optimisticEdge);

      return { optimisticEdge };
    },
    onError: (err, _newEdge, context) => {
      if (!context) return;
      deleteEdge(context.optimisticEdge.id);
      console.error(err);
      toast({
        title: "Error",
        description: err.message || "Failed to add edge",
        variant: "destructive",
      });
    },
  });

  const mutateAsync = useCallback(
    async (connection: Connection) => {
      // Validate connection first
      const validationResult = validateConnection(connection);

      if (!validationResult.valid || !validationResult.validatedEdge) {
        return false;
      }

      const validatedEdge = validationResult.validatedEdge;

      try {
        await mut({
          id: nanoid(),
          edge: {
            source: validatedEdge.source,
            target: validatedEdge.target,
            sourceHandle: validatedEdge.sourceHandle,
            targetHandle: validatedEdge.targetHandle,
          },
        });
        return true;
      } catch (error) {
        console.error("Error creating edge:", error);
        return false;
      }
    },
    [mut, validateConnection],
  );

  return { mutateAsync };
};
