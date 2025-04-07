import type * as THREE from "three";
import { useCallback, useEffect, useMemo, useRef } from "react";

import type { WebGLRenderTargetNode } from "@repo/threejs";
import type { NoiseTexture, Texture } from "@vendor/db/types";
import {
  isNumericValue,
  isVec2,
  noiseShaderSingleton,
  PNOISE_UNIFORM_CONSTRAINTS,
  UniformAdapterFactory,
  ValueType,
} from "@repo/webgl";

import { useTextureRenderStore } from "../providers/texture-render-store-provider";
import { useConnectionCache } from "./use-connection-cache";

export interface UpdateTextureNoiseProps {
  textureDataMap: Record<string, Texture>;
}

/**
 * Use the adapter factory to update a specific uniform
 */
const updateUniform = (
  shader: THREE.ShaderMaterial,
  key: string,
  value: unknown,
  uniformType: ValueType,
): void => {
  if (!shader.uniforms[key]) return;

  const adapter = UniformAdapterFactory.getAdapter(uniformType);
  if (adapter) {
    // Only update if value type matches expected type
    if (
      (uniformType === ValueType.Numeric && isNumericValue(value)) ||
      (uniformType === ValueType.Vec2 && isVec2(value))
    ) {
      shader.uniforms[key] = adapter.toThreeUniform(value);
    }
  }
};

/**
 * Update texture uniform with null-safe handling
 */
const updateTextureUniform = (
  shader: THREE.ShaderMaterial,
  key: string,
  texture: THREE.Texture | null,
): void => {
  if (shader.uniforms[key]) {
    shader.uniforms[key].value = texture;
  }
};

/**
 * Gets a texture from the targets map, with null-safety
 */
const getTextureFromTargets = (
  sourceId: string | null,
  targets: Record<string, { texture: THREE.Texture }>,
): THREE.Texture | null => {
  return sourceId && targets[sourceId] ? targets[sourceId].texture : null;
};

export const useUpdateTextureNoise = ({
  textureDataMap,
}: UpdateTextureNoiseProps): WebGLRenderTargetNode[] => {
  const { targets } = useTextureRenderStore((state) => state);
  const { getSourceForTarget } = useConnectionCache();

  // Store the shader material ref to be lazily initialized
  const shaderMaterialRef = useRef<THREE.ShaderMaterial | null>(null);

  // Store uniform configurations per texture ID instead of shader instances
  const uniformConfigsRef = useRef<Record<string, Record<string, unknown>>>({});

  // Create a reference to track render target nodes
  const renderTargetNodesRef = useRef<Record<string, WebGLRenderTargetNode>>(
    {},
  );

  // Track the set of texture IDs for cleanup
  const activeIdsRef = useRef<Set<string>>(new Set());

  /**
   * Gets or creates the shared shader material instance
   */
  const getSharedShaderMaterial = useCallback((): THREE.ShaderMaterial => {
    if (!shaderMaterialRef.current) {
      shaderMaterialRef.current = noiseShaderSingleton.getInstance();
    }
    return shaderMaterialRef.current;
  }, []);

  /**
   * Updates shader uniforms based on constraints
   */
  const updateShaderUniforms = useCallback(
    (shader: THREE.ShaderMaterial, uniforms: Record<string, unknown>): void => {
      // Use constraints from PNOISE_UNIFORM_CONSTRAINTS to determine types
      Object.entries(uniforms).forEach(([key, value]) => {
        if (!shader.uniforms[key]) return;

        const constraint = PNOISE_UNIFORM_CONSTRAINTS[key];
        if (!constraint) return;

        // Update based on the uniform's ValueType
        updateUniform(shader, key, value, constraint.type);
      });
    },
    [],
  );

  /**
   * Updates texture connection for a shader
   */
  const updateTextureConnection = useCallback(
    (shader: THREE.ShaderMaterial, id: string): void => {
      const sourceId = getSourceForTarget(id);
      const texture = getTextureFromTargets(sourceId, targets);
      updateTextureUniform(shader, "u_texture1", texture);
    },
    [getSourceForTarget, targets],
  );

  /**
   * Apply uniforms for a specific texture ID to the shared shader
   */
  const applyTextureUniforms = useCallback(
    (id: string): void => {
      const uniforms = uniformConfigsRef.current[id];
      if (!uniforms) return;

      // Get the shader material on demand
      const sharedShaderMaterial = getSharedShaderMaterial();

      // Apply stored uniforms to the shared material
      updateShaderUniforms(sharedShaderMaterial, uniforms);

      // Apply texture connection
      updateTextureConnection(sharedShaderMaterial, id);
    },
    [getSharedShaderMaterial, updateShaderUniforms, updateTextureConnection],
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

      // Create a new node that uses the shared shader material - get the shader lazily
      const node: WebGLRenderTargetNode = {
        id,
        // The shader will be retrieved at render time via getter
        get shader() {
          return getSharedShaderMaterial();
        },
        onEachFrame: () => {
          // Apply this texture's uniforms before rendering
          applyTextureUniforms(id);
        },
      };

      // Cache the node for future reuse
      renderTargetNodesRef.current[id] = node;

      return node;
    },
    [getSharedShaderMaterial, updateSingleTexture, applyTextureUniforms],
  );

  // Update textures and track active IDs whenever texture data changes
  useEffect(() => {
    // Skip if no textures are present
    if (Object.keys(textureDataMap).length === 0) {
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
    // This guarantees that we have nodes for all current textures
    return Object.entries(textureDataMap).map(([id, texture]) => {
      // Always ensure the node exists in our cache
      return getOrCreateRenderTargetNode(id, texture);
    });
  }, [textureDataMap, getOrCreateRenderTargetNode]);
};
