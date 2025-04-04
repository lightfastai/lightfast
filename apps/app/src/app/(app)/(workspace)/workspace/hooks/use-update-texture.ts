import type * as THREE from "three";
import { useCallback } from "react";

import type { TextureHandle } from "@repo/webgl";
import { textureRegistry } from "@repo/webgl";

import type { NodeStore } from "../stores/node-store";
import type { TextureRenderStore } from "../stores/texture-render-store";
import { useNodeStore } from "../providers/node-store-provider";
import { useTextureRenderStore } from "../providers/texture-render-store-provider";
import { useConnectionCache } from "./use-connection-cache";

/**
 * Hook for updating texture uniforms based on connections
 */
export function useUpdateTexture(textureType: string) {
  const connectionCache = useConnectionCache();
  const { targets } = useTextureRenderStore((state: TextureRenderStore) => ({
    targets: state.targets,
  }));
  const nodeTypes = useNodeStore((state: NodeStore) => {
    return state.nodes.reduce<Record<string, string>>((types, node) => {
      types[node.id] = node.type;
      return types;
    }, {});
  });

  const updateTextureUniforms = useCallback(
    (shader: THREE.ShaderMaterial, nodeId: string) => {
      const entry = textureRegistry[textureType];
      if (!entry) {
        console.warn(`No configuration found for texture type: ${textureType}`);
        return;
      }

      entry.handles.forEach((handle: TextureHandle) => {
        const sourceId = connectionCache.current[nodeId]?.[handle.id];
        const sourceType = sourceId ? nodeTypes[sourceId] : null;

        // Validate connection if it exists
        if (
          sourceId &&
          sourceType &&
          !entry.validateConnection(handle, sourceType)
        ) {
          console.warn(
            `Invalid connection for handle ${handle.id} from ${sourceType} to ${textureType}`,
          );
          return;
        }

        // Get texture object from source if connected
        const textureObject =
          sourceId && targets[sourceId]?.texture
            ? targets[sourceId].texture
            : null;

        // Update uniform if it exists in shader
        const uniform = shader.uniforms[handle.uniformName];
        if (uniform) {
          uniform.value = textureObject;
        }
      });
    },
    [connectionCache, nodeTypes, targets, textureType],
  );

  return {
    updateTextureUniforms,
  };
}
