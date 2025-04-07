import type * as THREE from "three";
import { useEffect, useRef } from "react";

/**
 * Hook to manage WebGL shader cache with automatic cleanup
 * Provides distinct methods for creating, accessing, and managing shaders
 */
export function useShaderCache() {
  // Cache of previously created shaders
  const shaderCache = useRef<Record<string, THREE.ShaderMaterial>>({});

  /**
   * Create a new shader and store it in the cache
   * @param id Unique identifier for the shader
   * @param createFn Function that creates the shader
   * @returns The created shader
   */
  const createShader = (
    id: string,
    createFn: () => THREE.ShaderMaterial,
  ): THREE.ShaderMaterial => {
    // Dispose of existing shader if it exists
    if (shaderCache.current[id]) {
      shaderCache.current[id].dispose();
    }

    // Create and store the new shader
    const shader = createFn();
    shaderCache.current[id] = shader;
    return shader;
  };

  /**
   * Get a shader from the cache
   * @param id Shader identifier
   * @returns The shader or undefined if not found
   */
  const getShader = (id: string): THREE.ShaderMaterial | undefined => {
    return shaderCache.current[id];
  };

  /**
   * Check if a shader exists in the cache
   * @param id Shader identifier
   * @returns Boolean indicating if the shader exists
   */
  const hasShader = (id: string): boolean => {
    return id in shaderCache.current;
  };

  /**
   * Dispose of and remove a shader from the cache
   * @param id Shader identifier
   */
  const removeShader = (id: string): void => {
    if (shaderCache.current[id]) {
      shaderCache.current[id].dispose();
      delete shaderCache.current[id];
    }
  };

  /**
   * Clear all shaders from the cache
   */
  const clearShaders = (): void => {
    Object.values(shaderCache.current).forEach((shader) => {
      shader.dispose();
    });
    shaderCache.current = {};
  };

  // Automatically clean up shaders when component unmounts
  useEffect(() => {
    return () => {
      clearShaders();
    };
  }, []);

  return {
    createShader,
    getShader,
    hasShader,
    removeShader,
    clearShaders,
    shaderCache: shaderCache.current,
  };
}
