import type * as THREE from "three";
import { useCallback, useEffect, useMemo, useRef } from "react";

import type { WebGLRenderTargetNode, WebGLRootState } from "@repo/threejs";
import type { LimitTexture, Texture } from "@vendor/db/types";
import {
  updateSamplerUniforms,
  updateUniforms,
  useShaderOrchestrator,
} from "@repo/threejs";
import { $Shaders, isExpression, LIMIT_UNIFORM_CONSTRAINTS } from "@repo/webgl";

import { useTextureRenderStore } from "../providers/texture-render-store-provider";
import { useConnectionCache } from "./use-connection-cache";
import { useExpressionEvaluator } from "./use-expression-evaluator";

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
  const { updateShaderUniforms } = useExpressionEvaluator();
  const { getShader, releaseShader } = useShaderOrchestrator(
    $Shaders.enum.Limit,
  );

  // Store uniform configurations per texture ID
  const uniformConfigsRef = useRef<Record<string, Record<string, unknown>>>({});

  // Create a reference to track render target nodes
  const renderTargetNodesRef = useRef<Record<string, WebGLRenderTargetNode>>(
    {},
  );

  // Cache expressions
  const expressionsRef = useRef<Record<string, Record<string, string>>>({});

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
   * Store expressions for a texture
   */
  const storeExpressions = useCallback(
    (id: string, texture: LimitTexture): void => {
      // Ensure expressions cache exists for this ID
      expressionsRef.current[id] = expressionsRef.current[id] || {};

      const { uniforms: u } = texture;

      // Store expressions
      if (isExpression(u.u_quantizationSteps)) {
        expressionsRef.current[id].u_quantizationSteps = u.u_quantizationSteps;
      }
    },
    [],
  );

  /**
   * Apply uniforms for a specific texture ID to its shader
   */
  const applyTextureUniforms = useCallback(
    (id: string): void => {
      const uniforms = uniformConfigsRef.current[id];
      if (!uniforms) return;

      // Get the shader
      const sharedShaderMaterial = getShader();

      // Apply stored uniforms to the material
      updateUniforms(sharedShaderMaterial, uniforms, LIMIT_UNIFORM_CONSTRAINTS);

      // Apply texture connection
      updateSampler2DConnection(sharedShaderMaterial, id);
    },
    [getShader, updateSampler2DConnection],
  );

  /**
   * Update a single texture with its current data
   */
  const updateSingleTexture = useCallback(
    (id: string, texture: Texture): void => {
      const limitTexture = texture as LimitTexture;

      // Store the uniform configuration for this texture
      uniformConfigsRef.current[id] = limitTexture.uniforms;

      // Store expressions for this texture
      storeExpressions(id, limitTexture);
    },
    [storeExpressions],
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
          // Get expressions for this node
          const expressions = expressionsRef.current[id] || {};

          // Apply this texture's uniforms before rendering
          applyTextureUniforms(id);

          // Define mapping for uniform components
          const uniformPathMap = {
            u_quantizationSteps: {
              pathToValue: "u_quantizationSteps.value",
            },
          };

          // Use the shared uniform update utility
          updateShaderUniforms(state, getShader(), expressions, uniformPathMap);
        },
      };

      // Cache the node for future reuse
      renderTargetNodesRef.current[id] = node;

      return node;
    },
    [
      updateSingleTexture,
      getShader,
      applyTextureUniforms,
      updateShaderUniforms,
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
      delete expressionsRef.current[id];
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
