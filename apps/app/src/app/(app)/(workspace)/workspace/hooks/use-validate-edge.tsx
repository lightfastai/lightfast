import { useCallback } from "react";

import { toast } from "@repo/ui/hooks/use-toast";

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
  const validateHandleType = useHandleTypeValidator();

  return {
    validateSelfConnection,
    validateSameSource,
    validateHandleType,
  };
};
