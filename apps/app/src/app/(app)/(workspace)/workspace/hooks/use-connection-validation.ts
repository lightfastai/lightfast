import type { Connection } from "@xyflow/react";
import { useCallback } from "react";

import type { InsertEdge } from "@vendor/db/schema";
import type { HandleId } from "@vendor/db/types";
import { useToast } from "@repo/ui/hooks/use-toast";
import { prepareEdgeForInsert } from "@vendor/db/schema";
import { createTextureHandleId, isOutputHandleId } from "@vendor/db/types";

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
        // Validate source handle is an output handle
        if (
          !connection.sourceHandle ||
          !isOutputHandleId(connection.sourceHandle)
        ) {
          throw new Error("Source must be an output handle");
        }

        // Validate target handle is a texture handle
        if (!connection.targetHandle) {
          throw new Error("Target handle is required");
        }

        const targetHandle = createTextureHandleId(connection.targetHandle);
        if (!targetHandle) {
          throw new Error("Target must be a valid texture handle");
        }

        // Try to prepare the edge with validation
        const validatedEdge = prepareEdgeForInsert({
          ...connection,
          sourceHandle: connection.sourceHandle as HandleId,
          targetHandle,
        } as InsertEdge);

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
