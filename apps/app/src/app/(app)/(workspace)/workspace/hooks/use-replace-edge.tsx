import type { Connection } from "@xyflow/react";
import { useCallback } from "react";

import { nanoid } from "@repo/lib";
import { toast } from "@repo/ui/hooks/use-toast";

import type { BaseEdge } from "../types/node";
import { api } from "~/trpc/client/react";
import { useEdgeStore } from "../providers/edge-store-provider";
import { convertToStrictConnection } from "../types/connection";
import {
  useSameSourceValidator,
  useSelfConnectionValidator,
} from "./use-validate-edge";

export const useReplaceEdge = () => {
  const { edges, addEdge, deleteEdge } = useEdgeStore((state) => state);
  const validateSelfConnection = useSelfConnectionValidator();
  const validateSameSource = useSameSourceValidator();

  const { mutateAsync: mutReplace } = api.tenant.edge.replace.useMutation({
    onMutate: ({ oldEdgeId, newEdge }) => {
      // Optimistically remove the old edge
      const oldEdge = edges.find((edge) => edge.id === oldEdgeId);
      if (!oldEdge) throw new Error("Old edge not found");
      deleteEdge(oldEdgeId);

      // Optimistically add the new edge
      const optimisticEdge = {
        ...newEdge,
        // Include required BaseEdge properties
        createdAt: new Date(),
        updatedAt: new Date(),
      } as BaseEdge;

      addEdge(optimisticEdge);

      return { oldEdge };
    },
    onError: (err, variables, context) => {
      if (context?.oldEdge) {
        // Rollback: restore the old edge
        addEdge(context.oldEdge);
      }
      console.error(err);
      toast({
        title: "Error",
        description: err.message || "Failed to replace edge",
        variant: "destructive",
      });
    },
    onSettled: () => {
      // Optionally invalidate queries or perform additional actions
    },
  });

  const mutateAsync = useCallback(
    async (oldEdgeId: string, newConnection: Connection) => {
      const { source, target } = newConnection;

      // Validate it's not a self connection
      if (
        !validateSelfConnection(source, target) ||
        !validateSameSource(source, target)
      ) {
        return false;
      }

      // Convert to strict connection to validate handles
      const strictConnection = convertToStrictConnection(newConnection);
      if (!strictConnection) {
        toast({
          title: "Invalid Connection",
          description: "The handles specified are not valid",
          variant: "destructive",
        });
        return false;
      }

      // Perform the replace mutation
      try {
        await mutReplace({
          oldEdgeId,
          newEdge: {
            id: nanoid(),
            source: strictConnection.source,
            target: strictConnection.target,
            sourceHandle: strictConnection.sourceHandle,
            targetHandle: strictConnection.targetHandle,
          },
        });
        return true;
      } catch (error) {
        console.error("Error replacing edge:", error);
        return false;
      }
    },
    [validateSelfConnection, validateSameSource, mutReplace],
  );

  return { mutateAsync };
};
