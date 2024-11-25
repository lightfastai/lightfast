import { useCallback } from "react";
import { Connection } from "@xyflow/react";

import { nanoid } from "@repo/lib";
import { toast } from "@repo/ui/hooks/use-toast";

import { api } from "~/trpc/react";
import { useEdgeStore } from "../providers/edge-store-provider";
import { BaseEdge } from "../types/node";
import { useEdgeValidation } from "./use-edge-validation";

export const useReplaceEdge = () => {
  const { edges, addEdge, deleteEdge } = useEdgeStore((state) => state);

  const { mutateAsync: mutReplace } = api.edge.replaceEdge.useMutation({
    onMutate: async ({ oldEdgeId, newEdge }) => {
      // Optimistically remove the old edge
      const oldEdge = edges.find((edge) => edge.id === oldEdgeId);
      if (!oldEdge) throw new Error("Old edge not found");
      deleteEdge(oldEdgeId);

      // Optimistically add the new edge
      const optimisticEdge: BaseEdge = {
        id: newEdge.id,
        source: newEdge.source,
        target: newEdge.target,
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
  } = useEdgeValidation();

  const mutateAsync = useCallback(
    async (oldEdgeId: string, newConnection: Connection) => {
      const { source, target } = newConnection;
      console.log("Replacing edge", oldEdgeId, newConnection);
      if (
        !validateSelfConnection(source, target) ||
        !validateTargetExistence(target) ||
        !validateMaxIncomingEdges(target, { allowance: 1 })
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
      mutReplace,
    ],
  );

  return { mutateAsync };
};
