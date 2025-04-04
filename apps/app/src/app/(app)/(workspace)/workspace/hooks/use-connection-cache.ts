import type { Edge } from "@xyflow/react";
import { useEffect, useRef } from "react";

import { useEdgeStore } from "../providers/edge-store-provider";
import { useTextureRenderStore } from "../providers/texture-render-store-provider";

/**
 * Interface for connection cache
 */
export type ConnectionCache = Record<string, Record<string, string | null>>;

/**
 * Hook for managing texture connections cache
 */
export function useConnectionCache() {
  const connectionCache = useRef<ConnectionCache>({});
  const edges = useEdgeStore((state) => state.edges);
  const targets = useTextureRenderStore((state) => state.targets);

  useEffect(() => {
    // Initialize cache for all nodes
    Object.keys(targets).forEach((nodeId) => {
      if (!connectionCache.current[nodeId]) {
        connectionCache.current[nodeId] = {};
      }
    });

    // Update cache based on edges
    edges.forEach((edge: Edge) => {
      const targetId = edge.target;
      const sourceId = edge.source;
      const handleId = edge.targetHandle;

      if (connectionCache.current[targetId] && handleId) {
        connectionCache.current[targetId][handleId] = sourceId;
      }
    });
  }, [edges, targets]);

  return connectionCache;
}
