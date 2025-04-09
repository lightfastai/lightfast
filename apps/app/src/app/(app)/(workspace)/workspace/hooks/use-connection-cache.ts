"use client";

import { useEffect, useRef } from "react";

import { useEdgeStore } from "../providers/edge-store-provider";

/**
 * A simplified hook to manage connections between nodes in the texture graph.
 * Provides essential methods to track and retrieve node connections.
 */
export function useConnectionCache() {
  // Single cache to store source->target connections
  const connectionCache = useRef<Record<string, string | null>>({});

  // Get edges from the edge store
  const { edges } = useEdgeStore((state) => state);

  // Update cache when edges change
  useEffect(() => {
    // Reset the cache
    connectionCache.current = {};

    // Update cache with current connections
    edges.forEach((edge) => {
      connectionCache.current[edge.target] = edge.source;
    });
  }, [edges]);

  /**
   * Gets the source node ID connected to a target node
   */
  const getSourceForTarget = (targetId: string): string | null => {
    return connectionCache.current[targetId] || null;
  };

  /**
   * Checks if a target node has any connection
   */
  const hasConnection = (targetId: string): boolean => {
    return (
      targetId in connectionCache.current &&
      connectionCache.current[targetId] !== null
    );
  };

  return {
    getSourceForTarget,
    hasConnection,
    // Expose the cache for debugging if needed
    connections: connectionCache.current,
  };
}
