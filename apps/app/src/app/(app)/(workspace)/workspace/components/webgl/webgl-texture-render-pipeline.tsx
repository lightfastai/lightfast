"use client";

import { useMemo } from "react";

import type { Texture } from "@vendor/db/types";
import { TextureRenderPipeline } from "@repo/threejs";

import { api } from "~/trpc/client/react";
import { useUpdateTextureAdd } from "../../hooks/use-update-texture-add";
import { useUpdateTextureDisplace } from "../../hooks/use-update-texture-displace";
import { useUpdateTextureLimit } from "../../hooks/use-update-texture-limit";
import { useUpdateTextureNoise } from "../../hooks/use-update-texture-noise";
import { useTextureRenderStore } from "../../providers/texture-render-store-provider";

export const WebGLTextureRenderPipeline = () => {
  const targets = useTextureRenderStore((state) => state.targets);

  // Get all texture nodes
  const queries = api.useQueries((t) =>
    Object.entries(targets).map(([id]) =>
      t.tenant.node.data.get<Texture>({
        id,
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

  // Get noise nodes using the grouped noise targets and texture data
  const noiseNodes = useUpdateTextureNoise({
    textureDataMap,
  });

  const limitNodes = useUpdateTextureLimit({
    textureDataMap,
  });

  const displaceNodes = useUpdateTextureDisplace({
    textureDataMap,
  });

  const addNodes = useUpdateTextureAdd({
    textureDataMap,
  });

  // Get all nodes (can add more types here later)
  const allNodes = useMemo(
    () => [...noiseNodes, ...limitNodes, ...displaceNodes, ...addNodes],
    [noiseNodes, limitNodes, displaceNodes, addNodes],
  );

  return <TextureRenderPipeline targets={targets} nodes={allNodes} />;
};
