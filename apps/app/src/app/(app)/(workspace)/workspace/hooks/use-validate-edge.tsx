import { useCallback } from "react";

import type { NodeType } from "@vendor/db/types";
import { toast } from "@repo/ui/hooks/use-toast";
import { getMaxTargetEdges } from "@vendor/db/types";

import { api } from "~/trpc/client/react";
import { useEdgeStore } from "../providers/edge-store-provider";
import { useNodeStore } from "../providers/node-store-provider";

/**
 * Validates that a node cannot connect to itself.
 * @returns A function that checks if the source and target nodes are different.
 */
export const useSelfConnectionValidator = () => {
  return useCallback((source: string, target: string): boolean => {
    if (source === target) {
      toast({
        variant: "destructive",
        description: "A node cannot connect to itself.",
      });
      return false;
    }
    return true;
  }, []);
};

/**
 * Validates that the source of an edge is the same.
 * Used primarily for edge replacement validation.
 * @returns A function that checks if two nodes have the same source.
 */
export const useSameSourceValidator = () => {
  return useCallback((source: string, target: string): boolean => {
    if (source === target) {
      toast({
        variant: "destructive",
        description: "A node cannot connect to itself.",
      });
      return false;
    }
    return true;
  }, []);
};

/**
 * Validates that the target node exists in the workspace.
 * @returns A function that checks if the target node exists.
 */
export const useTargetExistenceValidator = () => {
  const { nodes } = useNodeStore((state) => state);

  return useCallback(
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
};

/**
 * Validates that window nodes only have one incoming connection.
 * @returns A function that checks if the window node's connection limit is respected.
 */
export const useWindowNodeValidator = () => {
  const { nodes } = useNodeStore((state) => state);
  const { edges } = useEdgeStore((state) => state);

  return useCallback(
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
};

/**
 * Validates that the target node does not exceed the maximum number of incoming edges.
 * @returns A function that checks if the edge count is within limits for the node type.
 */
export const useMaxIncomingEdgesValidator = () => {
  const { nodes } = useNodeStore((state) => state);
  const { edges } = useEdgeStore((state) => state);
  const utils = api.useUtils();

  return useCallback(
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
};

/**
 * Validates that connections only flow from output handles to input handles.
 * @returns A function that checks if the connection is valid based on handle types.
 */
export const useHandleTypeValidator = () => {
  return useCallback(
    (sourceHandle: string | null, targetHandle: string | null): boolean => {
      // Source handles should be outputs, target handles should be inputs
      const isOutputHandle = (handle: string | null) =>
        handle?.includes("output");
      const isInputHandle = (handle: string | null) =>
        handle?.includes("input");

      if (!isOutputHandle(sourceHandle) || !isInputHandle(targetHandle)) {
        toast({
          variant: "destructive",
          description:
            "Invalid connection: Can only connect from output to input.",
        });
        return false;
      }
      return true;
    },
    [],
  );
};

/**
 * Original hook that provides all validation functions.
 * Maintained for backwards compatibility.
 * @returns An object containing all validation functions.
 */
export const useEdgeValidation = () => {
  const validateSelfConnection = useSelfConnectionValidator();
  const validateSameSource = useSameSourceValidator();
  const validateTargetExistence = useTargetExistenceValidator();
  const validateWindowNode = useWindowNodeValidator();
  const validateMaxIncomingEdges = useMaxIncomingEdgesValidator();
  const validateHandleType = useHandleTypeValidator();

  return {
    validateSelfConnection,
    validateTargetExistence,
    validateMaxIncomingEdges,
    validateSameSource,
    validateWindowNode,
    validateHandleType,
  };
};
