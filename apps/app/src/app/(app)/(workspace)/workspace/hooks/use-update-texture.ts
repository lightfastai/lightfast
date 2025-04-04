import type * as THREE from "three";
import { useCallback } from "react";

import type { TextureHandle } from "@repo/webgl";

import { useTextureRenderStore } from "../providers/texture-render-store-provider";
import { useConnectionCache } from "./use-connection-cache";

/**
 * Hook for updating texture uniforms based on connections
 */
export function useUpdateTexture() {
  const connectionCache = useConnectionCache();
  const targets = useTextureRenderStore((state) => state.targets);

  const updateTextureUniforms = useCallback(
    (
      shader: THREE.ShaderMaterial,
      nodeId: string,
      handles: TextureHandle[],
    ) => {
      handles.forEach((handle) => {
        const sourceId = connectionCache.current[nodeId]?.[handle.id];
        const target = sourceId ? targets[sourceId] : null;
        const textureObject = target?.texture ?? null;
        const uniformName = handle.uniformName;

        const uniform = shader.uniforms[uniformName];
        if (uniform) {
          uniform.value = textureObject;
        }
      });
    },
    [connectionCache, targets],
  );

  return {
    updateTextureUniforms,
  };
}
