import { useCallback, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

import type { WebGLRenderTargetNode, WebGLRootState } from "@repo/threejs";
import type { DisplaceTexture, Texture } from "@vendor/db/types";
import {
  baseVertexShader,
  displaceFragmentShader,
  isExpression,
} from "@repo/webgl";

import { useTextureRenderStore } from "../providers/texture-render-store-provider";
import { useConnectionCache } from "./use-connection-cache";
import { useExpressionEvaluator } from "./use-expression-evaluator";
import { useShaderCache } from "./use-shader-cache";

export interface UpdateTextureDisplaceProps {
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
 * Create a new shader material for displace texture
 */
const createDisplaceShaderMaterial = () => {
  // Create default vector values
  const defaultMidpoint = new THREE.Vector2(0.5, 0.5);
  const defaultOffset = new THREE.Vector2(0, 0);
  const defaultUVWeight = new THREE.Vector2(1.0, 1.0);

  return new THREE.ShaderMaterial({
    vertexShader: baseVertexShader,
    fragmentShader: displaceFragmentShader,
    uniforms: {
      u_texture1: { value: null }, // Source image
      u_texture2: { value: null }, // Displacement map
      u_displaceWeight: { value: 1.0 },
      u_displaceMidpoint: { value: defaultMidpoint.clone() },
      u_displaceOffset: { value: defaultOffset.clone() },
      u_displaceOffsetWeight: { value: 1.0 },
      u_displaceUVWeight: { value: defaultUVWeight.clone() },
    },
  });
};

export const useUpdateTextureDisplace = ({
  textureDataMap,
}: UpdateTextureDisplaceProps): WebGLRenderTargetNode[] => {
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

      // Map input-1 to u_texture1 (source image)
      if (shader.uniforms.u_texture1) {
        const sourceId = connections["input-1"] || null;
        shader.uniforms.u_texture1.value = getTextureFromTargets(
          sourceId,
          targets,
        );
      }

      // Map input-2 to u_texture2 (displacement map)
      if (shader.uniforms.u_texture2) {
        const sourceId = connections["input-2"] || null;
        shader.uniforms.u_texture2.value = getTextureFromTargets(
          sourceId,
          targets,
        );
      }
    },
    [getConnectionsForNode, targets],
  );

  /**
   * Store expressions for a texture
   */
  const storeExpressions = useCallback(
    (id: string, texture: DisplaceTexture): void => {
      // Ensure expressions cache exists for this ID
      expressionsRef.current[id] = expressionsRef.current[id] || {};

      const { uniforms: u } = texture;

      // Store all expressions for this node
      const storeExpression = (key: string, value: any) => {
        if (isExpression(value)) {
          expressionsRef.current[id]![key] = value;
        }
      };

      storeExpression("u_displaceWeight", u.u_displaceWeight);
      storeExpression("u_displaceMidpoint.x", u.u_displaceMidpoint.x);
      storeExpression("u_displaceMidpoint.y", u.u_displaceMidpoint.y);
      storeExpression("u_displaceOffset.x", u.u_displaceOffset.x);
      storeExpression("u_displaceOffset.y", u.u_displaceOffset.y);
      storeExpression("u_displaceOffsetWeight", u.u_displaceOffsetWeight);
      storeExpression("u_displaceUVWeight.x", u.u_displaceUVWeight.x);
      storeExpression("u_displaceUVWeight.y", u.u_displaceUVWeight.y);
    },
    [],
  );

  /**
   * Update numeric and vector uniforms for a shader
   */
  const updateUniforms = useCallback(
    (shader: THREE.ShaderMaterial, texture: DisplaceTexture): void => {
      const { uniforms: u } = texture;

      // Update numeric uniforms
      if (
        shader.uniforms.u_displaceWeight &&
        typeof u.u_displaceWeight === "number"
      ) {
        shader.uniforms.u_displaceWeight.value = u.u_displaceWeight;
      }

      if (
        shader.uniforms.u_displaceOffsetWeight &&
        typeof u.u_displaceOffsetWeight === "number"
      ) {
        shader.uniforms.u_displaceOffsetWeight.value = u.u_displaceOffsetWeight;
      }

      // Update vector uniforms
      if (shader.uniforms.u_displaceMidpoint) {
        const x =
          typeof u.u_displaceMidpoint.x === "number"
            ? u.u_displaceMidpoint.x
            : 0.5;
        const y =
          typeof u.u_displaceMidpoint.y === "number"
            ? u.u_displaceMidpoint.y
            : 0.5;
        shader.uniforms.u_displaceMidpoint.value.set(x, y);
      }

      if (shader.uniforms.u_displaceOffset) {
        const x =
          typeof u.u_displaceOffset.x === "number" ? u.u_displaceOffset.x : 0;
        const y =
          typeof u.u_displaceOffset.y === "number" ? u.u_displaceOffset.y : 0;
        shader.uniforms.u_displaceOffset.value.set(x, y);
      }

      if (shader.uniforms.u_displaceUVWeight) {
        const x =
          typeof u.u_displaceUVWeight.x === "number"
            ? u.u_displaceUVWeight.x
            : 1.0;
        const y =
          typeof u.u_displaceUVWeight.y === "number"
            ? u.u_displaceUVWeight.y
            : 1.0;
        shader.uniforms.u_displaceUVWeight.value.set(x, y);
      }
    },
    [],
  );

  /**
   * Initializes a shader with uniforms and texture connections
   */
  const initializeShader = useCallback(
    (
      shader: THREE.ShaderMaterial,
      id: string,
      texture: DisplaceTexture,
    ): void => {
      // Update numeric and vector uniforms
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
    (id: string, texture: DisplaceTexture): THREE.ShaderMaterial => {
      // Create new shader
      const shader = createShader(id, createDisplaceShaderMaterial);

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
    (id: string, texture: DisplaceTexture): THREE.ShaderMaterial => {
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
    (id: string, texture: DisplaceTexture): void => {
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
    (id: string, texture: DisplaceTexture): WebGLRenderTargetNode => {
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

          // Define mapping for vector uniform components
          const uniformPathMap = {
            "u_displaceMidpoint.x": {
              pathToValue: "u_displaceMidpoint.value.x",
            },
            "u_displaceMidpoint.y": {
              pathToValue: "u_displaceMidpoint.value.y",
            },
            "u_displaceOffset.x": {
              pathToValue: "u_displaceOffset.value.x",
            },
            "u_displaceOffset.y": {
              pathToValue: "u_displaceOffset.value.y",
            },
            "u_displaceUVWeight.x": {
              pathToValue: "u_displaceUVWeight.value.x",
            },
            "u_displaceUVWeight.y": {
              pathToValue: "u_displaceUVWeight.value.y",
            },
            u_displaceWeight: {
              pathToValue: "u_displaceWeight.value",
            },
            u_displaceOffsetWeight: {
              pathToValue: "u_displaceOffsetWeight.value",
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
    [getOrCreateShader, updateTextureConnections, updateShaderUniforms],
  );

  // Update textures and track active IDs whenever texture data changes
  useEffect(() => {
    // Get the new set of active IDs
    const currentIds = new Set(
      Object.entries(textureDataMap)
        .filter((entry): entry is [string, DisplaceTexture] => {
          const [_, texture] = entry;
          return texture.type === "Displace";
        })
        .map(([id]) => id),
    );

    // Update all relevant textures
    Object.entries(textureDataMap)
      .filter((entry): entry is [string, DisplaceTexture] => {
        const [_, texture] = entry;
        return texture.type === "Displace";
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
    // Filter the texture data map to only include Displace textures
    return Object.entries(textureDataMap)
      .filter((entry): entry is [string, DisplaceTexture] => {
        const [_, texture] = entry;
        return texture.type === "Displace";
      })
      .map(([id, texture]) => {
        // Always ensure the node exists in our cache
        return getOrCreateRenderTargetNode(id, texture);
      });
  }, [textureDataMap, getOrCreateRenderTargetNode]);
};
