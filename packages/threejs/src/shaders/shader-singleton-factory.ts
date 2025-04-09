import type * as THREE from "three";

import type { R3FShaderUniforms } from "../types/shader-uniforms";
import { createR3FShaderMaterial } from "./utils";

/**
 * Factory for creating shader material singletons
 * This allows for creating singleton instances of various shader materials
 * that can be reused across nodes, with only the uniforms changing.
 */
export interface ShaderSingleton {
  getInstance: () => THREE.ShaderMaterial;
  resetToDefaults: () => void;
  isInitialized: () => boolean;
  dispose: () => void;
}

/**
 * Creates a shader singleton for a specific shader type
 * Each singleton manages a single instance of a shader material
 * that can be shared across multiple nodes.
 *
 * @param vertexShader - The vertex shader code
 * @param fragmentShader - The fragment shader code
 * @param createDefaultUniforms - Function to create default uniforms for this shader
 * @returns A shader singleton object
 */
export const createShaderSingleton = (
  vertexShader: string,
  fragmentShader: string,
  createDefaultUniforms: () => R3FShaderUniforms,
): ShaderSingleton => {
  let instance: THREE.ShaderMaterial | null = null;

  return {
    /**
     * Get the shared shader material instance
     * Lazily initializes the material on first request
     */
    getInstance: (): THREE.ShaderMaterial => {
      if (!instance) {
        const baseUniforms = createDefaultUniforms();
        instance = createR3FShaderMaterial(
          vertexShader,
          fragmentShader,
          baseUniforms,
        );
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
        instance.uniforms = createDefaultUniforms();
      }
    },

    /**
     * Check if the shader material has been initialized
     */
    isInitialized: (): boolean => {
      return instance !== null;
    },

    /**
     * Disposes the shader material and releases memory
     * Should be called when no nodes are using the shader
     */
    dispose: (): void => {
      if (instance) {
        // Dispose uniforms that might hold textures or other disposable resources
        Object.values(instance.uniforms).forEach((uniform) => {
          // Note: Only dispose resources that are owned by this singleton
          // Textures from other nodes should not be disposed here
        });

        // Dispose the shader material itself
        instance.dispose();
        instance = null;
      }
    },
  };
};
