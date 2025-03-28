import type { Connection } from "@xyflow/react";
import { useCallback } from "react";

import { nanoid } from "@repo/lib";
import { toast } from "@repo/ui/hooks/use-toast";

import type { BaseEdge } from "../types/node";
import { api } from "~/trpc/client/react";
import { useEdgeStore } from "../providers/edge-store-provider";
import { useEdgeValidation } from "./use-validate-edge";

export const useReplaceEdge = () => {
  const { edges, addEdge, deleteEdge } = useEdgeStore((state) => state);

  const { mutateAsync: mutReplace } = api.tenant.edge.replace.useMutation({
    onMutate: async ({ oldEdgeId, newEdge }) => {
      // Optimistically remove the old edge
      const oldEdge = edges.find((edge) => edge.id === oldEdgeId);
      if (!oldEdge) throw new Error("Old edge not found");
      deleteEdge(oldEdgeId);

      // Optimistically add the new edge
      const optimisticEdge: BaseEdge = {
        ...newEdge,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      addEdge(optimisticEdge);

      return { oldEdge };
    },
    onError: (err, variables, context) => {
      if (context?.oldEdge) {
        // Rollback: restore the old edge
        addEdge(context.oldEdge);
        // Optionally, remove the newly added edge if necessary
      }
      console.error(err);
      toast({
        title: "Error",
        description: "Failed to replace edge",
      });
    },
    onSettled: () => {
      // Optionally invalidate queries or perform additional actions
    },
  });

  const {
    validateSelfConnection,
    validateTargetExistence,
    validateMaxIncomingEdges,
    validateSameSource,
    validateWindowNode,
  } = useEdgeValidation();

  const mutateAsync = useCallback(
    async (oldEdgeId: string, newConnection: Connection) => {
      const { source, target, sourceHandle, targetHandle } = newConnection;

      if (
        !validateSelfConnection(source, target) ||
        !validateSameSource(source, target) ||
        !validateTargetExistence(target) ||
        !validateMaxIncomingEdges(target, { allowance: 1 }) ||
        !validateWindowNode(target)
      ) {
        return;
      }

      // Perform the replace mutation
      try {
        await mutReplace({
          oldEdgeId,
          newEdge: {
            id: nanoid(),
            source,
            target,
            sourceHandle,
            targetHandle,
          },
        });
      } catch (error) {
        console.error(error);
        // Additional error handling if needed
      }
    },
    [
      validateSelfConnection,
      validateTargetExistence,
      validateMaxIncomingEdges,
      validateWindowNode,
      validateSameSource,
      mutReplace,
    ],
  );

  return { mutateAsync };
};
