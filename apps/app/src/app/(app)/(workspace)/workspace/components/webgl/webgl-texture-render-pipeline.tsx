"use client";

import { useMemo } from "react";

import type { Texture } from "@vendor/db/types";
import { TextureRenderPipeline } from "@repo/threejs";

import { api } from "~/trpc/client/react";
import { useUnifiedTextureOrchestrator } from "../../hooks/use-unified-texture-orchestrator";
import { useTextureRenderStore } from "../../providers/texture-render-store-provider";

export const WebGLTextureRenderPipeline = () => {
  const targets = useTextureRenderStore((state) => state.targets);

  // Get all texture nodes
  const queries = api.useQueries((t) =>
    Object.entries(targets).map(([id]) =>
      t.tenant.node.data.get<Texture>({
        nodeId: id,
      }),
    ),
  );

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
