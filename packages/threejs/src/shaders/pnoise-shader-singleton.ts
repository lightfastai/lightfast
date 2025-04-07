import * as THREE from "three";

import type { ShaderUniforms } from "@repo/webgl";
import {
  baseVertexShader,
  createDefaultPerlinNoise2D,
  createUniformsFromSchema,
  PNOISE_UNIFORM_CONSTRAINTS,
  pnoiseFragmentShader,
} from "@repo/webgl";

/**
 * Create default uniforms for a perlin noise shader
 */
const createDefaultNoiseUniforms = (): ShaderUniforms => {
  const defaultValues = createDefaultPerlinNoise2D();
  return createUniformsFromSchema(defaultValues, PNOISE_UNIFORM_CONSTRAINTS);
};

/**
 * Singleton for noise shader material
 * This ensures we only create a single instance of the noise shader material
 * that can be reused across all noise textures, just changing the uniforms.
 * The shader material is lazily initialized only when first requested.
 */
export const noiseShaderSingleton = (() => {
  let instance: THREE.ShaderMaterial | null = null;

  return {
    /**
     * Get the shared noise shader material instance
     * Lazily initializes the material on first request
     */
    getInstance: (): THREE.ShaderMaterial => {
      if (!instance) {
        const baseUniforms = createDefaultNoiseUniforms();
        instance = new THREE.ShaderMaterial({
          vertexShader: baseVertexShader,
          fragmentShader: pnoiseFragmentShader,
          uniforms: baseUniforms,
        });
      }
      return instance;
    },

    /**
     * Reset the uniforms to default values
     * Useful after rendering to ensure a clean state
     * Does nothing if the instance hasn't been created yet
     */
    resetToDefaults: (): void => {
      if (instance) {
        instance.uniforms = createDefaultNoiseUniforms();
      }
    },

    /**
     * Check if the shader material has been initialized
     */
    isInitialized: (): boolean => {
      return instance !== null;
    },
  };
})();
