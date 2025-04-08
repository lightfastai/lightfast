import type * as THREE from "three";
import { useCallback, useEffect, useMemo, useRef } from "react";

import type { WebGLRenderTargetNode, WebGLRootState } from "@repo/threejs";
import type { LimitParams } from "@repo/webgl";
import type { LimitTexture, Texture } from "@vendor/db/types";
import {
  updateSamplerUniforms,
  useShaderOrchestrator,
  useUnifiedUniforms,
} from "@repo/threejs";
import { $Shaders, LIMIT_UNIFORM_CONSTRAINTS } from "@repo/webgl";

import { useTextureRenderStore } from "../providers/texture-render-store-provider";
import { useConnectionCache } from "./use-connection-cache";

export interface UpdateTextureLimitProps {
  textureDataMap: Record<string, Texture>;
}

/**
 * Gets a texture from the targets map, with null-safety
 */
const getTextureFromTargets = (
  sourceId: string | null,
  targets: Record<string, { texture: THREE.Texture }>,
): THREE.Texture | null => {
  return sourceId && targets[sourceId] ? targets[sourceId].texture : null;
};

export const useUpdateTextureLimit = ({
  textureDataMap,
}: UpdateTextureLimitProps): WebGLRenderTargetNode[] => {
  const { targets } = useTextureRenderStore((state) => state);
  const { getSourceForTarget } = useConnectionCache();
  // Use the new unified uniforms hook
  const { updateAllUniforms } = useUnifiedUniforms();
  const { getShader, releaseShader } = useShaderOrchestrator(
    $Shaders.enum.Limit,
  );

  // Store uniform configurations per texture ID
  const uniformConfigsRef = useRef<Record<string, LimitParams>>({});

  // Create a reference to track render target nodes
  const renderTargetNodesRef = useRef<Record<string, WebGLRenderTargetNode>>(
    {},
  );

  // Track the set of texture IDs for cleanup
  const activeIdsRef = useRef<Set<string>>(new Set());

  /**
   * Updates texture connection for a shader
   */
  const updateSampler2DConnection = useCallback(
    (shader: THREE.ShaderMaterial, id: string): void => {
      const sourceId = getSourceForTarget(id);
      const texture = getTextureFromTargets(sourceId, targets);
      updateSamplerUniforms(shader, { u_texture1: texture });
    },
    [getSourceForTarget, targets],
  );

  /**
   * Update a single texture with its current data
   */
  const updateSingleTexture = useCallback(
    (id: string, texture: Texture): void => {
      const limitTexture = texture as LimitTexture;

      // Store the uniform configuration for this texture - properly typed as LimitParams
      uniformConfigsRef.current[id] = {
        u_texture1: { vuvID: null }, // This will be handled by updateSampler2DConnection
        u_quantizationSteps: limitTexture.uniforms.u_quantizationSteps,
      };
    },
    [],
  );

  /**
   * Create or get a cached WebGLRenderTargetNode for a texture
   */
  const getOrCreateRenderTargetNode = useCallback(
    (id: string, texture: Texture): WebGLRenderTargetNode => {
      // If we already have a node for this id, reuse it
      if (renderTargetNodesRef.current[id]) {
        return renderTargetNodesRef.current[id];
      }

      // Update texture uniform configuration
      updateSingleTexture(id, texture);

      const node: WebGLRenderTargetNode = {
        id,
        get shader() {
          return getShader();
        },
        onEachFrame: (state: WebGLRootState) => {
          // Get the uniform values for this node
          const uniforms = uniformConfigsRef.current[id];
          if (!uniforms) return;

          // Get the shader material
          const shader = getShader();

          // Apply texture connection
          updateSampler2DConnection(shader, id);

          // Use the unified approach to update all uniforms in one pass
          // This handles both basic values and expressions
          updateAllUniforms(state, shader, uniforms, LIMIT_UNIFORM_CONSTRAINTS);
        },
      };

      // Cache the node for future reuse
      renderTargetNodesRef.current[id] = node;

      return node;
    },
    [
      updateSingleTexture,
      getShader,
      updateSampler2DConnection,
      updateAllUniforms,
    ],
  );

  // Update textures and track active IDs whenever texture data changes
  useEffect(() => {
    const hasTextures = Object.keys(textureDataMap).length > 0;

    // Skip if no textures are present
    if (!hasTextures) {
      // Release the shader reference if we no longer have textures
      releaseShader();

      // Clean up all stored uniform configurations
      uniformConfigsRef.current = {};

      // Clean up all render target nodes
      renderTargetNodesRef.current = {};

      return;
    }

    // Get the new set of active IDs
    const currentIds = new Set(
      Object.entries(textureDataMap)
        .filter((entry): entry is [string, LimitTexture] => {
          const [_, texture] = entry;
          return texture.type === "Limit";
        })
        .map(([id]) => id),
    );

    // Update all relevant textures
    Object.entries(textureDataMap)
      .filter((entry): entry is [string, LimitTexture] => {
        const [_, texture] = entry;
        return texture.type === "Limit";
      })
      .forEach(([id, texture]) => {
        updateSingleTexture(id, texture);

        // Ensure we have a render target node for each texture
        getOrCreateRenderTargetNode(id, texture);
      });

    // Clean up nodes that are no longer in the texture data map
    const nodesToRemove: string[] = [];
    Object.keys(renderTargetNodesRef.current).forEach((id) => {
      if (!currentIds.has(id)) {
        nodesToRemove.push(id);
      }
    });

    // Remove unused nodes
    nodesToRemove.forEach((id) => {
      delete renderTargetNodesRef.current[id];
      delete uniformConfigsRef.current[id];
    });

    // Update active IDs reference
    activeIdsRef.current = currentIds;
  }, [
    textureDataMap,
    updateSingleTexture,
    getOrCreateRenderTargetNode,
    releaseShader,
  ]);

  // Return the render target nodes with stable references
  return useMemo(() => {
    // If no textures exist, return an empty array
    if (Object.keys(textureDataMap).length === 0) {
      return [];
    }

    // Create an array of nodes from the current texture data map
    // This guarantees that we have nodes for all current textures
    return Object.entries(textureDataMap).map(([id, texture]) => {
      // Always ensure the node exists in our cache
      return getOrCreateRenderTargetNode(id, texture);
    });
  }, [textureDataMap, getOrCreateRenderTargetNode]);
};
