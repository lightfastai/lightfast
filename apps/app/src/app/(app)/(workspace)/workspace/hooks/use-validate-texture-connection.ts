import { useCallback } from "react";

import { textureRegistry } from "@repo/webgl";

import type { EdgeStore } from "../stores/edge-store";
import { useEdgeStore } from "../providers/edge-store-provider";

/**
 * Hook for validating texture connections
 */
export function useValidateTextureConnection() {
  const edges = useEdgeStore((state: EdgeStore) => state.edges);

  const validateConnection = useCallback(
    (
      sourceId: string,
      sourceType: string,
      targetId: string,
      targetType: string,
      targetHandle: string,
    ): boolean => {
      // Check if connection already exists
      const existingConnection = edges.find(
        (edge) =>
          edge.target === targetId && edge.targetHandle === targetHandle,
      );

      if (existingConnection) {
        return false;
      }

      // Get texture config and validate connection
      const entry = textureRegistry[targetType];
      if (!entry) {
        return false;
      }

      // Find the handle being connected to
      const handle = entry.handles.find((h) => h.id === targetHandle);
      if (!handle) {
        return false;
      }

      // Validate the connection using the texture type's validation rules
      return entry.validateConnection(handle, sourceType);
    },
    [edges],
  );

  return validateConnection;
}
