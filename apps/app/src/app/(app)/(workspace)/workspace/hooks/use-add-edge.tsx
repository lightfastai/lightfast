import type { Connection } from "@xyflow/react";
import { useCallback } from "react";

import { nanoid } from "@repo/lib";
import { toast } from "@repo/ui/hooks/use-toast";

import type { BaseEdge } from "../types/node";
import { api } from "~/trpc/client/react";
import { useEdgeStore } from "../providers/edge-store-provider";
import { convertToStrictConnection } from "../types/connection";
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

  const mutateAsync = useCallback(
    async (connection: Connection) => {
      const { source, target } = connection;

      // Validate it's not a self connection
      if (!validateSelfConnection(source, target)) {
        return false;
      }

      // Convert to strict connection to validate handles
      const strictConnection = convertToStrictConnection(connection);
      if (!strictConnection) {
        toast({
          title: "Invalid Connection",
          description: "The handles specified are not valid",
          variant: "destructive",
        });
        return false;
      }

      try {
        await mut({
          id: nanoid(),
          edge: {
            source: strictConnection.source,
            target: strictConnection.target,
            sourceHandle: strictConnection.sourceHandle,
            targetHandle: strictConnection.targetHandle,
          },
        });
        return true;
      } catch (error) {
        console.error("Error creating edge:", error);
        return false;
      }
    },
    [mut, validateSelfConnection],
  );

  return { mutateAsync };
};
