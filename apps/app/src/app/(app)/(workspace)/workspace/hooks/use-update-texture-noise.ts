import type * as THREE from "three";
import { useCallback, useEffect, useMemo, useRef } from "react";

import type { WebGLRenderTargetNode } from "@repo/threejs";
import type { NoiseTexture, Texture } from "@vendor/db/types";
import {
  baseVertexShader,
  createDefaultPerlinNoise2D,
  createShaderMaterial,
  createUniformsFromSchema,
  isNumericValue,
  isVec2,
  PNOISE_UNIFORM_CONSTRAINTS,
  pnoiseFragmentShader,
  UniformAdapterFactory,
  ValueType,
} from "@repo/webgl";

import { useTextureRenderStore } from "../providers/texture-render-store-provider";
import { useConnectionCache } from "./use-connection-cache";
import { useShaderCache } from "./use-shader-cache";

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

/**
 * Create default uniforms for a perlin noise shader
 */
const createDefaultNoiseUniforms = () => {
  const defaultValues = createDefaultPerlinNoise2D();
  return createUniformsFromSchema(defaultValues, PNOISE_UNIFORM_CONSTRAINTS);
};

/**
 * Create a new shader material for noise texture
 */
const createNoiseShaderMaterial = () => {
  const baseUniforms = createDefaultNoiseUniforms();
  return createShaderMaterial(
    baseVertexShader,
    pnoiseFragmentShader,
    baseUniforms,
  );
};

export const useUpdateTextureNoise = ({
  textureDataMap,
}: UpdateTextureNoiseProps): WebGLRenderTargetNode[] => {
  const { targets } = useTextureRenderStore((state) => state);
  const { createShader, getShader, hasShader } = useShaderCache();
  const { getSourceForTarget } = useConnectionCache();

  // Create a reference to track shader instances
  const shaderInstancesRef = useRef<Record<string, THREE.ShaderMaterial>>({});

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
   * Creates a new shader and initializes it
   */
  const createAndInitShader = useCallback(
    (id: string, texture: NoiseTexture): THREE.ShaderMaterial => {
      // Create new shader
      const shader = createShader(id, createNoiseShaderMaterial);

      // Store reference to the created shader
      shaderInstancesRef.current[id] = shader;

      // Initialize shader with uniform values and texture connections
      initializeShader(shader, id, texture);

      return shader;
    },
    [createShader],
  );

  /**
   * Initializes a shader with uniforms and texture connections
   */
  const initializeShader = useCallback(
    (shader: THREE.ShaderMaterial, id: string, texture: NoiseTexture): void => {
      // Apply uniform values
      updateShaderUniforms(shader, texture.uniforms);

      // Set texture connection
      updateTextureConnection(shader, id);
    },
    [updateShaderUniforms, updateTextureConnection],
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
   * Create or get shader and ensure it's initialized with correct uniforms
   */
  const getOrCreateShader = useCallback(
    (id: string, texture: NoiseTexture): THREE.ShaderMaterial => {
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
    (id: string, texture: Texture): void => {
      const noiseTexture = texture as NoiseTexture;

      // Get the shader (will create if it doesn't exist)
      const shader = getOrCreateShader(id, noiseTexture);

      // Update uniforms with latest values
      updateShaderUniforms(shader, noiseTexture.uniforms);

      // Update texture connection
      updateTextureConnection(shader, id);
    },
    [getOrCreateShader, updateShaderUniforms, updateTextureConnection],
  );

  // Update uniforms whenever texture data changes
  useEffect(() => {
    Object.entries(textureDataMap).forEach(([id, texture]) => {
      updateSingleTexture(id, texture);
    });
  }, [textureDataMap, updateSingleTexture]);

  /**
   * Create WebGLRenderTargetNode for a texture
   */
  const createRenderTargetNode = useCallback(
    (id: string, texture: Texture): WebGLRenderTargetNode => {
      const noiseTexture = texture as NoiseTexture;
      const shader = getOrCreateShader(id, noiseTexture);

      return {
        id,
        shader,
        onEachFrame: () => {}, // Empty as requested
      };
    },
    [getOrCreateShader],
  );

  // Return the render target nodes with guaranteed initialized shaders
  return useMemo(() => {
    return Object.entries(textureDataMap).map(([id, texture]) =>
      createRenderTargetNode(id, texture),
    );
  }, [textureDataMap, createRenderTargetNode]);
};
