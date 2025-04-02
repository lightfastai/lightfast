import { useCallback } from "react";

import type { NodeType } from "@vendor/db/types";
import { toast } from "@repo/ui/hooks/use-toast";
import { getMaxTargetEdges } from "@vendor/db/types";

import { api } from "~/trpc/client/react";
import { useEdgeStore } from "../providers/edge-store-provider";
import { useNodeStore } from "../providers/node-store-provider";

export const useEdgeValidation = () => {
  const { edges } = useEdgeStore((state) => state);
  const { nodes } = useNodeStore((state) => state);
  const utils = api.useUtils();

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

  const validateSameSource = useCallback(
    (source: string, target: string): boolean => {
      return source === target;
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

  const validateWindowNode = useCallback(
    (target: string): boolean => {
      const targetNode = nodes.find((n) => n.id === target);
      if (!targetNode) return false;

      // For window nodes, allow exactly one connection
      if (targetNode.type === "window") {
        const currentEdgeCount = edges.filter(
          (edge) => edge.target === target,
        ).length;

        if (currentEdgeCount >= 1) {
          toast({
            variant: "destructive",
            description: "Window nodes can only accept one connection.",
          });
          return false;
        }
      }
      return true;
    },
    [nodes, edges],
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

      // Handle special cases based on node type
      if (targetNode.type === "texture") {
        // For Displace and Add texture nodes, allow 2 connections
        // Get cached texture type from TRPC cache if available
        const cachedData = utils.tenant.node.data.get.getData({ id: target });

        if (
          cachedData &&
          typeof cachedData === "object" &&
          "type" in cachedData
        ) {
          console.log("Using cached node data:", cachedData);

          if (cachedData.type === "Displace" || cachedData.type === "Add") {
            // Check if we're exceeding 2 connections
            const currentEdgeCount = edges.filter(
              (edge) => edge.target === target,
            ).length;

            console.log("Texture special case:", {
              type: cachedData.type,
              currentEdges: currentEdgeCount,
              maxAllowed: 2,
              allowance,
            });

            if (currentEdgeCount - allowance >= 2) {
              toast({
                variant: "destructive",
                description: `${cachedData.type} texture nodes cannot accept more than 2 incoming connections.`,
              });
              return false;
            }
            return true; // Allow connection for these special types
          }
        }
      }

      // For all other cases, use the standard implementation
      const nodeData = targetNode.data ? targetNode.data : undefined;
      const nodeType = targetNode.type as NodeType;

      const maxEdges = getMaxTargetEdges(nodeType, nodeData);

      const currentEdgeCount = edges.filter(
        (edge) => edge.target === target,
      ).length;

      if (currentEdgeCount - allowance >= maxEdges) {
        toast({
          variant: "destructive",
          description: `${nodeType} nodes cannot accept more than ${maxEdges} incoming connections.`,
        });
        return false;
      }
      return true;
    },
    [nodes, edges, utils.tenant.node.data],
  );

  return {
    validateSelfConnection,
    validateTargetExistence,
    validateMaxIncomingEdges,
    validateSameSource,
    validateWindowNode,
  };
};
