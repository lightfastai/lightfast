import type * as THREE from "three";
import { useCallback, useEffect, useMemo, useRef } from "react";

import type { WebGLRenderTargetNode, WebGLRootState } from "@repo/threejs";
import type { Shaders } from "@repo/webgl";
import type { Texture } from "@vendor/db/types";
import { useShaderOrchestratorMap, useUnifiedUniforms } from "@repo/threejs";
import { getAllShaderTypes, shaderRegistry } from "@repo/webgl";

import { useTextureRenderStore } from "../providers/texture-render-store-provider";
import { useConnectionCache } from "./use-connection-cache";

export interface UnifiedTextureOrchestratorProps {
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
 * Unified hook for managing multiple texture types with their shader orchestration
 * Handles shader creation, uniform updates, and memory management for all texture types
 */
export const useUnifiedTextureOrchestrator = ({
  textureDataMap,
}: UnifiedTextureOrchestratorProps): WebGLRenderTargetNode[] => {
  const { targets } = useTextureRenderStore((state) => state);
  const { getSourceForTarget } = useConnectionCache();
  const { updateAllUniforms } = useUnifiedUniforms();

  // Get all available shader types
  const shaderTypes = useMemo(() => getAllShaderTypes(), []);

  // Get the map of shader orchestrators
  const orchestrators = useShaderOrchestratorMap();

  /**
   * Type guard to check if a value is a valid Shaders type using the actual shader types
   */
  const isValidShaderType = useCallback(
    (type: string): type is Shaders => {
      return shaderTypes.includes(type as Shaders);
    },
    [shaderTypes],
  );

  // Store uniform configurations per texture ID
  const uniformConfigsRef = useRef<Record<string, Texture>>({});

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
      // Validate that the texture type is a valid shader type
      if (!isValidShaderType(texture.type)) {
        throw new Error(`Invalid texture type: ${texture.type}`);
      }

      // Store the uniform configuration for this texture based on its type
      uniformConfigsRef.current[id] = texture;
    },
    [isValidShaderType],
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

      // Get the appropriate shader orchestrator for this texture type
      // Type safety is ensured by updateSingleTexture validating the type
      const shaderType = texture.type;
      const orchestrator = orchestrators[shaderType];

      // Get the shader definition to access the constraints
      // @TODO: This is a bit of a hack, we should probably move this to the orchestrator, also could crash if the shader is not registered
      const shaderDefinition = shaderRegistry.get(shaderType);
      if (!shaderDefinition) {
        throw new Error(
          `Shader definition not registered for type: ${shaderType}`,
        );
      }

      const node: WebGLRenderTargetNode = {
        id,
        get shader() {
          return orchestrator.getShader();
        },
        onEachFrame: (state: WebGLRootState) => {
          // Get the uniform values and type for this node
          const config = uniformConfigsRef.current[id];
          if (!config) return;

          // Get the shader material
          const shader = orchestrator.getShader();

          // Create a texture resolver for this specific node
          const textureResolver = createTextureResolver(id);

          // Use the unified approach to update all uniforms in one pass
          updateAllUniforms(
            state,
            shader,
            config.uniforms,
            shaderDefinition.constraints,
            textureResolver,
          );
        },
      };

      // Cache the node for future reuse
      renderTargetNodesRef.current[id] = node;

      return node;
    },
    [
      updateSingleTexture,
      createTextureResolver,
      updateAllUniforms,
      orchestrators,
    ],
  );

  // Update textures and track active IDs whenever texture data changes
  useEffect(() => {
    const hasTextures = Object.keys(textureDataMap).length > 0;

    // Skip if no textures are present
    if (!hasTextures) {
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
  }, [textureDataMap, updateSingleTexture, getOrCreateRenderTargetNode]);

  // Return the render target nodes with stable references
  return useMemo(() => {
    // If no textures exist, return an empty array
    if (Object.keys(textureDataMap).length === 0) {
      return [];
    }

    // Create an array of nodes from the current texture data map
    return Object.entries(textureDataMap).map(([id, texture]) => {
      // Always ensure the node exists in our cache
      return getOrCreateRenderTargetNode(id, texture);
    });
  }, [textureDataMap, getOrCreateRenderTargetNode]);
};
