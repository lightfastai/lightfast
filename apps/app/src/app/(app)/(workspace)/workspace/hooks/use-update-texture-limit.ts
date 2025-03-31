import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

import { baseVertexShader, limitFragmentShader } from "@repo/webgl";

import type { WebGLRootState } from "../components/webgl/webgl-primitives";
import type { TextureRenderNode } from "../types/render";
import type { LimitTexture, Texture } from "~/db/schema/types/Texture";
import { api } from "~/trpc/client/react";
import { useEdgeStore } from "../providers/edge-store-provider";
import { useTextureRenderStore } from "../providers/texture-render-store-provider";

export const useUpdateTextureLimit = (): TextureRenderNode[] => {
  const { targets } = useTextureRenderStore((state) => state);
  const { edges } = useEdgeStore((state) => state);
  // Cache of previously created shaders to avoid recreating them
  const shaderCache = useRef<Record<string, THREE.ShaderMaterial>>({});
  // Cache of connections between nodes
  const connectionCache = useRef<Record<string, string | null>>({});

  const queries = api.useQueries((t) =>
    Object.entries(targets).map(([id]) =>
      t.tenant.node.data.get<Texture>({ id }),
    ),
  );

  // Extract texture data only when queries change
  const textureDataMap = useMemo(() => {
    return Object.entries(targets).reduce<Record<string, Texture | null>>(
      (acc, [id], index) => {
        acc[id] = queries[index]?.data || null;
        return acc;
      },
      {},
    );
  }, [queries, targets]);

  // Update connection cache when edges change
  useEffect(() => {
    // Reset connections that might have changed
    connectionCache.current = {};

    // Populate with current connections
    edges.forEach((edge) => {
      connectionCache.current[edge.target] = edge.source;
    });
  }, [edges]);

  // Create render nodes only when necessary
  return useMemo(() => {
    return Object.entries(textureDataMap)
      .filter((entry): entry is [string, LimitTexture] => {
        const [_, texture] = entry;
        return texture?.type === "Limit";
      })
      .map(([id, texture]) => {
        const { uniforms: u } = texture;
        const sourceNodeId = connectionCache.current[id] || null;

        // Reuse shader if available
        if (!shaderCache.current[id]) {
          shaderCache.current[id] = new THREE.ShaderMaterial({
            vertexShader: baseVertexShader,
            fragmentShader: limitFragmentShader,
            uniforms: {
              u_texture: { value: null },
              u_quantizationSteps: { value: u.u_quantizationSteps },
            },
          });
        }

        // Update uniform values (but not the uniform objects themselves)
        const shader = shaderCache.current[id];
        if (shader.uniforms.u_quantizationSteps) {
          shader.uniforms.u_quantizationSteps.value = u.u_quantizationSteps;
        }

        return {
          id,
          shader,
          onEachFrame: (_: WebGLRootState) => {
            // Only update the texture reference, not doing the edge lookup on each frame
            const sourceId = connectionCache.current[id];
            if (shader.uniforms.u_texture) {
              shader.uniforms.u_texture.value = sourceId
                ? targets[sourceId]?.texture
                : null;
            }
          },
        };
      });
  }, [textureDataMap, targets]);
};
