import type { Connection } from "@xyflow/react";
import { useCallback } from "react";

import { nanoid } from "@repo/lib";
import { toast } from "@repo/ui/hooks/use-toast";

import type { BaseEdge } from "../types/node";
import { api } from "~/trpc/client/react";
import { useEdgeStore } from "../providers/edge-store-provider";
import { useSelfConnectionValidator } from "./use-validate-edge";

export const useAddEdge = () => {
  const { addEdge, deleteEdge } = useEdgeStore((state) => state);
  const validateSelfConnection = useSelfConnectionValidator();

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

  /**
   * Create a regular edge connection
   */
  const createRegularConnection = useCallback(
    async (connection: Connection) => {
      try {
        await mut({
          id: nanoid(),
          edge: {
            source: connection.source,
            target: connection.target,
            sourceHandle: connection.sourceHandle ?? "",
            targetHandle: connection.targetHandle ?? "",
          },
        });
        return true;
      } catch (error) {
        console.error("Error creating edge:", error);
        return false;
      }
    },
    [mut],
  );

  /**
   * Main function to handle edge connections with explicit handle validation
   */
  const mutateAsync = useCallback(
    async (connection: Connection) => {
      const { source, target, targetHandle } = connection;

      // Validate that targetHandle exists
      if (!targetHandle) {
        toast({
          title: "Error",
          description: "Missing target handle specification",
          variant: "destructive",
        });
        return false;
      }

      // Only keep essential client-side validation
      if (!validateSelfConnection(source, target)) {
        return false;
      }

      // Simply add the new edge - replacement logic is in workspace.tsx
      return await createRegularConnection(connection);
    },
    [validateSelfConnection, createRegularConnection],
  );

  return { mutateAsync };
};
