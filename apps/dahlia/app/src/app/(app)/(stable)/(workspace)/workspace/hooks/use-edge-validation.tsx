import { useCallback } from "react";

import { getMaxTargetEdges } from "@repo/db/schema";
import { toast } from "@repo/ui/hooks/use-toast";

import { useEdgeStore } from "../providers/edge-store-provider";
import { useNodeStore } from "../providers/node-store-provider";

export const useEdgeValidation = () => {
  const { edges } = useEdgeStore((state) => state);
  const { nodes } = useNodeStore((state) => state);

  const validateSelfConnection = useCallback(
    (source: string, target: string): boolean => {
      if (source === target) {
        toast({
          variant: "destructive",
          description: "A node cannot connect to itself.",
        });
        return false;
      }
      return true;
    },
    [],
  );

  const validateTargetExistence = useCallback(
    (target: string): boolean => {
      const targetNode = nodes.find((n) => n.id === target);
      if (!targetNode) {
        toast({
          variant: "destructive",
          description: "Target node does not exist.",
        });
        return false;
      }
      return true;
    },
    [nodes],
  );

  /**
   * Validates that the target node does not exceed the maximum number of incoming edges.
   *
   * @param target - The ID of the target node.
   * @param opts - Optional parameters for validation.
   *               - allowance: The number of additional edges allowed (default is 0).
   *                            Useful in scenarios like replacing an edge, where one edge
   *                            is being removed and another is being added, effectively
   *                            allowing the total count to remain the same.
   * @returns `true` if the validation passes, `false` otherwise.
   */
  const validateMaxIncomingEdges = useCallback(
    (
      target: string,
      opts: { allowance?: number } = { allowance: 0 },
    ): boolean => {
      const { allowance = 0 } = opts;
      const targetNode = nodes.find((n) => n.id === target);
      if (!targetNode) return false;
      const maxEdges = getMaxTargetEdges(targetNode.type);
      const currentEdgeCount = edges.filter(
        (edge) => edge.target === target,
      ).length;
      if (currentEdgeCount - allowance > maxEdges) {
        toast({
          variant: "destructive",
          description: `${targetNode.type} nodes cannot accept more than ${maxEdges} incoming connections.`,
        });
        return false;
      }
      return true;
    },
    [nodes, edges],
  );

  return {
    validateSelfConnection,
    validateTargetExistence,
    validateMaxIncomingEdges,
  };
};
