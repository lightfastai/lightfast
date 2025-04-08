import type * as THREE from "three";
import { useCallback, useEffect, useMemo, useRef } from "react";

import type { WebGLRenderTargetNode, WebGLRootState } from "@repo/threejs";
import type { PerlinNoise2DParams } from "@repo/webgl";
import type { NoiseTexture, Texture } from "@vendor/db/types";
import { useShaderOrchestrator, useUnifiedUniforms } from "@repo/threejs";
import { $Shaders, PNOISE_UNIFORM_CONSTRAINTS } from "@repo/webgl";

import { useTextureRenderStore } from "../providers/texture-render-store-provider";
import { useConnectionCache } from "./use-connection-cache";

export interface UpdateTextureNoiseProps {
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

/**
 * Hook for processing and rendering perlin noise textures.
 * Uses a shared shader material managed by the useNoiseShaderSingleton hook.
 */
export const useUpdateTextureNoise = ({
  textureDataMap,
}: UpdateTextureNoiseProps): WebGLRenderTargetNode[] => {
  const { targets } = useTextureRenderStore((state) => state);
  const { getSourceForTarget } = useConnectionCache();
  const { updateAllUniforms } = useUnifiedUniforms();
  const { getShader, releaseShader } = useShaderOrchestrator(
    $Shaders.enum.Noise,
  );

  // Store uniform configurations per texture ID instead of shader instances
  const uniformConfigsRef = useRef<Record<string, PerlinNoise2DParams>>({});

  // Create a reference to track render target nodes
  const renderTargetNodesRef = useRef<Record<string, WebGLRenderTargetNode>>(
    {},
  );

  // Track the set of texture IDs for cleanup
  const activeIdsRef = useRef<Set<string>>(new Set());

  /**
   * Creates a texture resolver function for a specific node ID
   */
  const createTextureResolver = useCallback(
    (nodeId: string) => {
      // Return a function that resolves textures from samplers
      return (_sampler: Record<string, unknown>): THREE.Texture | null => {
        const sourceId = getSourceForTarget(nodeId);
        return getTextureFromTargets(sourceId, targets);
      };
    },
    [getSourceForTarget, targets],
  );

  /**
   * Update a single texture with its current data
   */
  const updateSingleTexture = useCallback(
    (id: string, texture: Texture): void => {
      const noiseTexture = texture as NoiseTexture;

      // Store the uniform configuration for this texture
      uniformConfigsRef.current[id] = noiseTexture.uniforms;
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

          // Create a texture resolver for this specific node
          const textureResolver = createTextureResolver(id);

          // Use the unified approach to update all uniforms in one pass
          // This now handles texture connections through the texture resolver
          updateAllUniforms(
            state,
            shader,
            uniforms,
            PNOISE_UNIFORM_CONSTRAINTS,
            textureResolver,
          );
        },
      };

      // Cache the node for future reuse
      renderTargetNodesRef.current[id] = node;

      return node;
    },
    [updateSingleTexture, getShader, createTextureResolver, updateAllUniforms],
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
    const currentIds = new Set(Object.keys(textureDataMap));

    // Update all textures
    Object.entries(textureDataMap).forEach(([id, texture]) => {
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
