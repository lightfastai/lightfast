"use client";

import { useMemo } from "react";

import type { Texture } from "@vendor/db/types";
import { TextureRenderPipeline } from "@repo/threejs";

import { api } from "~/trpc/client/react";
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
    textureDataMap: Object.fromEntries(
      Object.entries(textureDataMap).filter(
        ([_, texture]) => texture.type === "Noise",
      ),
    ),
  });

  const limitNodes = useUpdateTextureLimit({
    textureDataMap: Object.fromEntries(
      Object.entries(textureDataMap).filter(
        ([_, texture]) => texture.type === "Limit",
      ),
    ),
  });

  // const displaceNodes = useUpdateTextureDisplace({
  //   textureDataMap: Object.fromEntries(
  //     Object.entries(textureDataMap).filter(
  //       ([_, texture]) => texture.type === "Displace",
  //     ),
  //   ),
  // });

  // const addNodes = useUpdateTextureAdd({
  //   textureDataMap: Object.fromEntries(
  //     Object.entries(textureDataMap).filter(
  //       ([_, texture]) => texture.type === "Add",
  //     ),
  //   ),
  // });

  // Get all nodes (can add more types here later)
  const allNodes = useMemo(
    () => [...noiseNodes, ...limitNodes],
    [noiseNodes, limitNodes],
  );

  return <TextureRenderPipeline targets={targets} nodes={allNodes} />;
};
