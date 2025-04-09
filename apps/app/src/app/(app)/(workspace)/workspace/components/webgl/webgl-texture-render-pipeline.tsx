"use client";

import { useMemo } from "react";
import { useQueries } from "@tanstack/react-query";

import type { Texture } from "@vendor/db/types";
import { TextureRenderPipeline } from "@repo/threejs";

import { useTRPC } from "~/trpc/client/react";
import { useUnifiedTextureOrchestrator } from "../../hooks/use-unified-texture-orchestrator";
import { useTextureRenderStore } from "../../providers/texture-render-store-provider";

export const WebGLTextureRenderPipeline = () => {
  const targets = useTextureRenderStore((state) => state.targets);
  const trpc = useTRPC();

  // Get all texture nodes
  const queries = useQueries({
    queries: Object.entries(targets).map(([id]) =>
      trpc.tenant.node.data.get.queryOptions({ id }),
    ),
  });

  // Create a map of texture data by ID
  const textureDataMap = useMemo(() => {
    return Object.entries(targets).reduce<Record<string, Texture>>(
      (acc, [id], index) => {
        if (queries[index]?.data) {
          acc[id] = queries[index].data;
        }
        return acc;
      },
      {},
    );
  }, [targets, queries]);

  // Use the unified texture orchestrator for all texture types
  const allNodes = useUnifiedTextureOrchestrator({
    textureDataMap,
  });

  return <TextureRenderPipeline targets={targets} nodes={allNodes} />;
};
