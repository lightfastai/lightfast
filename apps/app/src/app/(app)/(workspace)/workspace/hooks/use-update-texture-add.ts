import { useCallback, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

import type { WebGLRenderTargetNode, WebGLRootState } from "@repo/threejs";
import type { AddTexture, Texture } from "@vendor/db/types";
import { useExpressionEvaluator } from "@repo/threejs";
import {
  addFragmentShader,
  baseVertexShader,
  getShaderSampler2DInputsForType,
  isExpression,
} from "@repo/webgl";

import { useTextureRenderStore } from "../providers/texture-render-store-provider";
import { useConnectionCache } from "./use-connection-cache";
import { useShaderCache } from "./use-shader-cache";

export interface UpdateTextureAddProps {
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
 * Create a new shader material for add texture
 */
const createAddShaderMaterial = (addValue = 0.0, enableMirror = false) => {
  return new THREE.ShaderMaterial({
    vertexShader: baseVertexShader,
    fragmentShader: addFragmentShader,
    uniforms: {
      // Initialize texture uniforms
      u_texture1: { value: null },
      u_texture2: { value: null },
      // Regular uniforms
      u_addValue: { value: addValue },
      u_enableMirror: { value: enableMirror },
    },
  });
};

export const useUpdateTextureAdd = ({
  textureDataMap,
}: UpdateTextureAddProps): WebGLRenderTargetNode[] => {
  const { targets } = useTextureRenderStore((state) => state);
  const { getConnectionsForNode } = useConnectionCache();
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
   * Updates texture connections for a shader
   */
  const updateTextureConnections = useCallback(
    (shader: THREE.ShaderMaterial, id: string): void => {
      const connections = getConnectionsForNode(id);
      const textureInputs = getShaderSampler2DInputsForType("Add");

      // Update texture uniforms based on connections
      textureInputs.forEach((input) => {
        const { handle } = input;
        const { handleId, uniformName } = handle;

        // Get the source node ID from the connection cache
        const sourceId = connections[handleId] || null;

        // Update the shader uniform
        if (shader.uniforms[uniformName]) {
          shader.uniforms[uniformName].value = getTextureFromTargets(
            sourceId,
            targets,
          );
        }
      });
    },
    [getConnectionsForNode, targets],
  );

  /**
   * Store expressions for a texture
   */
  const storeExpressions = useCallback(
    (id: string, texture: AddTexture): void => {
      // Ensure expressions cache exists for this ID
      expressionsRef.current[id] = expressionsRef.current[id] || {};

      const { uniforms: u } = texture;

      // Store numeric expressions
      if (isExpression(u.u_addValue)) {
        expressionsRef.current[id].u_addValue = u.u_addValue;
      }
    },
    [],
  );

  /**
   * Update numeric and boolean uniforms for a shader
   */
  const updateUniforms = useCallback(
    (shader: THREE.ShaderMaterial, texture: AddTexture): void => {
      const { uniforms: u } = texture;

      // Update numeric uniforms
      if (shader.uniforms.u_addValue && typeof u.u_addValue === "number") {
        shader.uniforms.u_addValue.value = u.u_addValue;
      }

      // Update boolean uniform directly
      if (shader.uniforms.u_enableMirror) {
        shader.uniforms.u_enableMirror.value = Boolean(u.u_enableMirror);
      }
    },
    [],
  );

  /**
   * Initializes a shader with uniforms and texture connections
   */
  const initializeShader = useCallback(
    (shader: THREE.ShaderMaterial, id: string, texture: AddTexture): void => {
      // Update numeric and boolean uniforms
      updateUniforms(shader, texture);

      // Set texture connections
      updateTextureConnections(shader, id);

      // Store expressions for this texture
      storeExpressions(id, texture);
    },
    [updateUniforms, updateTextureConnections, storeExpressions],
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
    (id: string, texture: AddTexture): THREE.ShaderMaterial => {
      const { uniforms: u } = texture;

      // Get initial values or use defaults
      const addValue = typeof u.u_addValue === "number" ? u.u_addValue : 0.0;
      const enableMirror = Boolean(u.u_enableMirror);

      // Create new shader
      const shader = createShader(id, () =>
        createAddShaderMaterial(addValue, enableMirror),
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
    (id: string, texture: AddTexture): THREE.ShaderMaterial => {
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
    (id: string, texture: AddTexture): void => {
      // Get the shader (will create if it doesn't exist)
      const shader = getOrCreateShader(id, texture);

      // Update uniforms with latest values
      updateUniforms(shader, texture);

      // Update texture connections
      updateTextureConnections(shader, id);

      // Store expressions
      storeExpressions(id, texture);
    },
    [
      getOrCreateShader,
      updateUniforms,
      updateTextureConnections,
      storeExpressions,
    ],
  );

  /**
   * Create or get a cached WebGLRenderTargetNode for a texture
   */
  const getOrCreateRenderTargetNode = useCallback(
    (id: string, texture: AddTexture): WebGLRenderTargetNode => {
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

          // Update the texture connections
          updateTextureConnections(shader, id);

          // Define mapping for uniform components
          const uniformPathMap = {
            u_addValue: {
              pathToValue: "u_addValue.value",
            },
          };

          // Update boolean uniform
          if (shader.uniforms.u_enableMirror) {
            const { uniforms: u } = texture;
            shader.uniforms.u_enableMirror.value = Boolean(u.u_enableMirror);
          }

          // Use the shared uniform update utility
          updateShaderUniforms(state, shader, expressions, uniformPathMap);
        },
      };

      // Cache the node for future reuse
      renderTargetNodesRef.current[id] = node;

      return node;
    },
    [getOrCreateShader, updateTextureConnections, updateShaderUniforms],
  );

  // Update textures and track active IDs whenever texture data changes
  useEffect(() => {
    // Get the new set of active IDs
    const currentIds = new Set(
      Object.entries(textureDataMap)
        .filter((entry): entry is [string, AddTexture] => {
          const [_, texture] = entry;
          return texture.type === "Add";
        })
        .map(([id]) => id),
    );

    // Update all relevant textures
    Object.entries(textureDataMap)
      .filter((entry): entry is [string, AddTexture] => {
        const [_, texture] = entry;
        return texture.type === "Add";
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
    // Filter the texture data map to only include Add textures
    return Object.entries(textureDataMap)
      .filter((entry): entry is [string, AddTexture] => {
        const [_, texture] = entry;
        return texture.type === "Add";
      })
      .map(([id, texture]) => {
        // Always ensure the node exists in our cache
        return getOrCreateRenderTargetNode(id, texture);
      });
  }, [textureDataMap, getOrCreateRenderTargetNode]);
};
