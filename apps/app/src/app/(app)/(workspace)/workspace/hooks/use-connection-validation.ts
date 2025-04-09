import type { Connection } from "@xyflow/react";
import { useCallback } from "react";

import type { InsertEdge } from "@vendor/db/schema";
import { useToast } from "@repo/ui/hooks/use-toast";
import { prepareEdgeForInsert } from "@vendor/db/schema";
import { isOutputHandleId } from "@vendor/db/types";

import { convertToStrictConnection } from "../types/connection";

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
        // First, try to convert to a strict connection
        const strictConnection = convertToStrictConnection(connection);
        if (!strictConnection) {
          throw new Error("Invalid source or target handle");
        }

        // Validate source handle is an output handle
        if (!isOutputHandleId(strictConnection.sourceHandle)) {
          throw new Error("Source must be an output handle");
        }

        // Validate target handle is a texture handle
        const isTextureHandle =
          strictConnection.targetHandle.startsWith("input");
        if (!isTextureHandle) {
          throw new Error("Target must be a valid texture handle");
        }

        // Try to prepare the edge with validation
        const validatedEdge = prepareEdgeForInsert({
          ...connection,
          sourceHandle: strictConnection.sourceHandle,
          targetHandle: strictConnection.targetHandle,
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
