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

export const useUpdateTextureNoise = ({
  textureDataMap,
}: UpdateTextureNoiseProps): WebGLRenderTargetNode[] => {
  const { targets } = useTextureRenderStore((state) => state);
  const { createShader, getShader, hasShader } = useShaderCache();
  const { getSourceForTarget } = useConnectionCache();

  // Create a reference to track shader instances
  const shaderInstancesRef = useRef<Record<string, THREE.ShaderMaterial>>({});

  // Type-safe uniform updater that matches uniform constraints
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

  // Create or get shader and ensure it's initialized with correct uniforms
  const getOrCreateShader = useCallback(
    (id: string, texture: NoiseTexture): THREE.ShaderMaterial => {
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

      // Create new shader
      const shader = createShader(id, () => {
        // Create default uniforms from the schema
        const defaultValues = createDefaultPerlinNoise2D();
        const baseUniforms = createUniformsFromSchema(
          defaultValues,
          PNOISE_UNIFORM_CONSTRAINTS,
        );

        // Create shader with default uniforms
        return createShaderMaterial(
          baseVertexShader,
          pnoiseFragmentShader,
          baseUniforms,
        );
      });

      // Store reference to the created shader
      shaderInstancesRef.current[id] = shader;

      // Apply initial uniform values using type-safe updates
      updateShaderUniforms(shader, texture.uniforms);

      // Set texture connections with null-safe handling
      const sourceId = getSourceForTarget(id);
      updateTextureUniform(
        shader,
        "u_texture1",
        sourceId && targets[sourceId] ? targets[sourceId].texture : null,
      );

      return shader;
    },
    [
      createShader,
      getShader,
      getSourceForTarget,
      hasShader,
      targets,
      updateShaderUniforms,
    ],
  );

  // Update uniforms whenever texture data changes
  useEffect(() => {
    Object.entries(textureDataMap).forEach(([id, texture]) => {
      const noiseTexture = texture as NoiseTexture;

      // Get the shader (will create if it doesn't exist)
      const shader = getOrCreateShader(id, noiseTexture);

      // Update uniforms with latest values
      updateShaderUniforms(shader, noiseTexture.uniforms);

      // Update texture connections with null-safe handling
      const sourceId = getSourceForTarget(id);
      updateTextureUniform(
        shader,
        "u_texture1",
        sourceId && targets[sourceId] ? targets[sourceId].texture : null,
      );
    });
  }, [
    textureDataMap,
    getSourceForTarget,
    targets,
    getOrCreateShader,
    updateShaderUniforms,
  ]);

  // Return the render target nodes with guaranteed initialized shaders
  return useMemo(() => {
    return Object.entries(textureDataMap).map(([id]) => {
      const texture = textureDataMap[id] as NoiseTexture;

      // Get or create the shader (guaranteed to be initialized)
      const shader = getOrCreateShader(id, texture);

      return {
        id,
        shader,
        onEachFrame: () => {}, // Empty as requested
      };
    });
  }, [getOrCreateShader, textureDataMap]);
};
