import { useEffect, useRef } from "react";

import { useEdgeStore } from "../providers/edge-store-provider";

/**
 * Hook to manage connections between nodes in the texture graph
 * Provides methods to track, retrieve, and manage node connections
 */
export function useConnectionCache() {
  // Store for simple source->target connections
  const simpleConnectionCache = useRef<Record<string, string | null>>({});

  // Store for connections with multiple inputs (target->handle->source mapping)
  const handleConnectionCache = useRef<
    Record<string, Record<string, string | null>>
  >({});

  // Get the edge store to monitor connections
  const { edges } = useEdgeStore((state) => state);

  /**
   * Updates the connection cache when edges change
   */
  useEffect(() => {
    // Reset the connection caches
    simpleConnectionCache.current = {};
    handleConnectionCache.current = {};

    // Populate with current connections
    edges.forEach((edge) => {
      // Store in simple connection cache (target -> source)
      simpleConnectionCache.current[edge.target] = edge.source;

      // Store in handle connection cache (target -> handle -> source)
      if (edge.targetHandle) {
        // Initialize the target node's handle map if needed
        if (!handleConnectionCache.current[edge.target]) {
          handleConnectionCache.current[edge.target] = {};
        }

        // Store the source for this specific handle
        handleConnectionCache.current[edge.target][edge.targetHandle] =
          edge.source;
      }
    });
  }, [edges]);

  /**
   * Gets the source node ID connected to a target node
   * @param targetId The ID of the target node
   * @returns The source node ID or null if not connected
   */
  const getSourceForTarget = (targetId: string): string | null => {
    return simpleConnectionCache.current[targetId] || null;
  };

  /**
   * Gets the source node ID connected to a specific handle of a target node
   * @param targetId The ID of the target node
   * @param handleId The ID of the input handle
   * @returns The source node ID or null if not connected
   */
  const getSourceForHandle = (
    targetId: string,
    handleId: string,
  ): string | null => {
    return handleConnectionCache.current[targetId]?.[handleId] || null;
  };

  /**
   * Checks if a target node has a connection
   * @param targetId The ID of the target node
   * @returns True if the target has any connection
   */
  const hasConnection = (targetId: string): boolean => {
    return (
      targetId in simpleConnectionCache.current &&
      simpleConnectionCache.current[targetId] !== null
    );
  };

  /**
   * Checks if a specific handle of a target node has a connection
   * @param targetId The ID of the target node
   * @param handleId The ID of the input handle
   * @returns True if the handle has a connection
   */
  const hasHandleConnection = (targetId: string, handleId: string): boolean => {
    return (
      targetId in handleConnectionCache.current &&
      handleId in handleConnectionCache.current[targetId] &&
      handleConnectionCache.current[targetId][handleId] !== null
    );
  };

  /**
   * Gets all handles for a target node that have connections
   * @param targetId The ID of the target node
   * @returns Array of handle IDs that have connections
   */
  const getConnectedHandles = (targetId: string): string[] => {
    if (!handleConnectionCache.current[targetId]) {
      return [];
    }

    return Object.entries(handleConnectionCache.current[targetId])
      .filter(([_, sourceId]) => sourceId !== null)
      .map(([handleId]) => handleId);
  };

  /**
   * Gets all connections for a specific node
   * @param targetId The ID of the target node
   * @returns Record mapping handle IDs to source node IDs
   */
  const getConnectionsForNode = (
    targetId: string,
  ): Record<string, string | null> => {
    return handleConnectionCache.current[targetId] || {};
  };

  return {
    getSourceForTarget,
    getSourceForHandle,
    hasConnection,
    hasHandleConnection,
    getConnectedHandles,
    getConnectionsForNode,
    // Exposed for direct access if needed
    simpleConnectionCache: simpleConnectionCache.current,
    handleConnectionCache: handleConnectionCache.current,
  };
}
