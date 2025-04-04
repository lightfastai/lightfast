import type { Connection } from "@xyflow/react";
import { useCallback } from "react";

import type { HandleId, InsertEdge } from "@vendor/db/schema";
import { useToast } from "@repo/ui/hooks/use-toast";
import { prepareEdgeForInsert, validateEdgeHandles } from "@vendor/db/schema";

export interface ConnectionValidationResult {
  valid: boolean;
  error?: string;
  validatedEdge?: InsertEdge;
}

export const useConnectionValidation = () => {
  const { toast } = useToast();

  const validateConnection = useCallback(
    (connection: Connection): ConnectionValidationResult => {
      try {
        // Try to prepare the edge with validation
        const validatedEdge = prepareEdgeForInsert({
          ...connection,
          sourceHandle: connection.sourceHandle as HandleId,
          targetHandle: connection.targetHandle as HandleId,
        } as InsertEdge);

        // Additional validation for handle compatibility
        if (!validateEdgeHandles(validatedEdge)) {
          throw new Error(
            "Invalid connection: source must be an output handle and target must be a texture handle",
          );
        }

        return {
          valid: true,
          validatedEdge,
        };
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Invalid connection";

        toast({
          title: "Invalid Connection",
          description: errorMessage,
          variant: "destructive",
        });

        return {
          valid: false,
          error: errorMessage,
        };
      }
    },
    [toast],
  );

  return {
    validateConnection,
  };
};
