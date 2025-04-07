import { useCallback, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

import type { WebGLRenderTargetNode, WebGLRootState } from "@repo/threejs";
import type { LimitTexture, Texture } from "@vendor/db/types";
import {
  baseVertexShader,
  isExpression,
  limitFragmentShader,
} from "@repo/webgl";

import { useTextureRenderStore } from "../providers/texture-render-store-provider";
import { useConnectionCache } from "./use-connection-cache";
import { useExpressionEvaluator } from "./use-expression-evaluator";
import { useShaderCache } from "./use-shader-cache";

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

/**
 * Create a new shader material for limit texture
 */
const createLimitShaderMaterial = (quantizationSteps = 8) => {
  return new THREE.ShaderMaterial({
    vertexShader: baseVertexShader,
    fragmentShader: limitFragmentShader,
    uniforms: {
      u_texture1: { value: null },
      u_quantizationSteps: { value: quantizationSteps },
    },
  });
};

export const useUpdateTextureLimit = ({
  textureDataMap,
}: UpdateTextureLimitProps): WebGLRenderTargetNode[] => {
  const { targets } = useTextureRenderStore((state) => state);
  const { getSourceForTarget } = useConnectionCache();
  const { createShader, getShader, hasShader } = useShaderCache();
  const { updateShaderUniforms } = useExpressionEvaluator();

  // Create a reference to track shader instances
  const shaderInstancesRef = useRef<Record<string, THREE.ShaderMaterial>>({});

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
  const updateTextureConnection = useCallback(
    (shader: THREE.ShaderMaterial, id: string): void => {
      const sourceId = getSourceForTarget(id);
      const texture = getTextureFromTargets(sourceId, targets);

      if (shader.uniforms.u_texture1) {
        shader.uniforms.u_texture1.value = texture;
      }
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
   * Update numeric uniforms for a shader
   */
  const updateNumericUniforms = useCallback(
    (shader: THREE.ShaderMaterial, texture: LimitTexture): void => {
      const { uniforms: u } = texture;

      if (
        shader.uniforms.u_quantizationSteps &&
        typeof u.u_quantizationSteps === "number"
      ) {
        shader.uniforms.u_quantizationSteps.value = u.u_quantizationSteps;
      }
    },
    [],
  );

  /**
   * Initializes a shader with uniforms and texture connections
   */
  const initializeShader = useCallback(
    (shader: THREE.ShaderMaterial, id: string, texture: LimitTexture): void => {
      // Update numeric uniforms
      updateNumericUniforms(shader, texture);

      // Set texture connection
      updateTextureConnection(shader, id);

      // Store expressions for this texture
      storeExpressions(id, texture);
    },
    [updateNumericUniforms, updateTextureConnection, storeExpressions],
  );

  /**
   * Get a shader from cache or create a new one
   */
  const getExistingShader = useCallback(
    (id: string): THREE.ShaderMaterial | null => {
      // Check if already created in this component instance
      if (shaderInstancesRef.current[id]) {
        return shaderInstancesRef.current[id];
      }

      // Check if exists in shader cache
      if (hasShader(id)) {
        const shader = getShader(id);
        if (shader) {
          shaderInstancesRef.current[id] = shader;
          return shader;
        }
      }

      return null;
    },
    [getShader, hasShader],
  );

  /**
   * Creates a new shader and initializes it
   */
  const createAndInitShader = useCallback(
    (id: string, texture: LimitTexture): THREE.ShaderMaterial => {
      const { uniforms: u } = texture;

      // Use numeric value or default
      const quantizationSteps =
        typeof u.u_quantizationSteps === "number" ? u.u_quantizationSteps : 8;

      // Create new shader
      const shader = createShader(id, () =>
        createLimitShaderMaterial(quantizationSteps),
      );

      // Store reference to the created shader
      shaderInstancesRef.current[id] = shader;

      // Initialize shader with uniform values and texture connections
      initializeShader(shader, id, texture);

      return shader;
    },
    [createShader, initializeShader],
  );

  /**
   * Create or get shader and ensure it's initialized with correct uniforms
   */
  const getOrCreateShader = useCallback(
    (id: string, texture: LimitTexture): THREE.ShaderMaterial => {
      // Try to get existing shader
      const existingShader = getExistingShader(id);
      if (existingShader) {
        return existingShader;
      }

      // Create new shader if not found
      return createAndInitShader(id, texture);
    },
    [getExistingShader, createAndInitShader],
  );

  /**
   * Update a single texture with its current data
   */
  const updateSingleTexture = useCallback(
    (id: string, texture: LimitTexture): void => {
      // Get the shader (will create if it doesn't exist)
      const shader = getOrCreateShader(id, texture);

      // Update uniforms with latest values
      updateNumericUniforms(shader, texture);

      // Update texture connection
      updateTextureConnection(shader, id);

      // Store expressions
      storeExpressions(id, texture);
    },
    [
      getOrCreateShader,
      updateNumericUniforms,
      updateTextureConnection,
      storeExpressions,
    ],
  );

  /**
   * Create or get a cached WebGLRenderTargetNode for a texture
   */
  const getOrCreateRenderTargetNode = useCallback(
    (id: string, texture: LimitTexture): WebGLRenderTargetNode => {
      // If we already have a node for this id, reuse it
      if (renderTargetNodesRef.current[id]) {
        return renderTargetNodesRef.current[id];
      }

      // Get or create the shader
      const shader = getOrCreateShader(id, texture);

      const node: WebGLRenderTargetNode = {
        id,
        shader,
        onEachFrame: (state: WebGLRootState) => {
          // Get expressions for this node
          const expressions = expressionsRef.current[id] || {};

          // Update the texture reference
          updateTextureConnection(shader, id);

          // Define mapping for uniform components
          const uniformPathMap = {
            u_quantizationSteps: {
              pathToValue: "u_quantizationSteps.value",
            },
          };

          // Use the shared uniform update utility
          updateShaderUniforms(state, shader, expressions, uniformPathMap);
        },
      };

      // Cache the node for future reuse
      renderTargetNodesRef.current[id] = node;

      return node;
    },
    [getOrCreateShader, updateTextureConnection, updateShaderUniforms],
  );

  // Update textures and track active IDs whenever texture data changes
  useEffect(() => {
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
    });

    // Update active IDs reference
    activeIdsRef.current = currentIds;
  }, [textureDataMap, updateSingleTexture, getOrCreateRenderTargetNode]);

  // Return the render target nodes with stable references
  return useMemo(() => {
    // Filter the texture data map to only include Limit textures
    return Object.entries(textureDataMap)
      .filter((entry): entry is [string, LimitTexture] => {
        const [_, texture] = entry;
        return texture.type === "Limit";
      })
      .map(([id, texture]) => {
        // Always ensure the node exists in our cache
        return getOrCreateRenderTargetNode(id, texture);
      });
  }, [textureDataMap, getOrCreateRenderTargetNode]);
};
