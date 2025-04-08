"use client";

import type * as THREE from "three";
import { useCallback, useEffect, useRef } from "react";

import type { ShaderSingleton } from "../shaders/shader-singleton-factory";

/**
 * Interface for shader material orchestrator
 * Provides methods to acquire and release shaders with automatic cleanup
 */
export interface ShaderMaterialOrchestrator {
  /**
   * Acquires the shared shader material.
   * Automatically increments reference count.
   */
  getShader: () => THREE.ShaderMaterial;

  /**
   * Releases a reference to the shader.
   * When reference count reaches zero, the shader will be disposed.
   */
  releaseShader: () => void;

  /**
   * Checks if the shader is currently initialized
   */
  isInitialized: () => boolean;
}

/**
 * Global map to track reference counts for different shader singletons
 * Keys are unique identifiers for each shader type
 */
const globalShaderRefCounts = new Map<string, number>();

/**
 * Hook to manage the lifecycle of any shader singleton.
 * Provides methods to acquire and release the shader with automatic cleanup.
 * Uses reference counting to ensure proper disposal when no longer needed.
 *
 * @param shaderKey - A unique identifier for this shader type
 * @param shaderSingleton - The shader singleton instance to manage
 * @returns An orchestrator for managing the shader
 */
export function useShaderMaterialOrchestrator(
  shaderKey: string,
  shaderSingleton: ShaderSingleton,
): ShaderMaterialOrchestrator {
  // Reference to track if this hook instance has acquired the shader
  const hasReference = useRef<boolean>(false);

  /**
   * Gets the shader and increases the reference count
   */
  const getShader = useCallback((): THREE.ShaderMaterial => {
    // Increment reference count for this shader type
    if (!hasReference.current) {
      const currentCount = globalShaderRefCounts.get(shaderKey) || 0;
      globalShaderRefCounts.set(shaderKey, currentCount + 1);
      hasReference.current = true;
    }

    // Get or create the shader from singleton
    return shaderSingleton.getInstance();
  }, [shaderKey, shaderSingleton]);

  /**
   * Releases this hook's reference to the shader
   */
  const releaseShader = useCallback((): void => {
    if (hasReference.current) {
      // Decrement reference count
      const currentCount = globalShaderRefCounts.get(shaderKey) || 1;
      const newCount = currentCount - 1;

      if (newCount <= 0) {
        // If no more references exist, dispose the shader and remove from map
        if (shaderSingleton.isInitialized()) {
          shaderSingleton.dispose();
        }
        globalShaderRefCounts.delete(shaderKey);
      } else {
        // Otherwise just update the count
        globalShaderRefCounts.set(shaderKey, newCount);
      }

      hasReference.current = false;
    }
  }, [shaderKey, shaderSingleton]);

  /**
   * Checks if the shader is currently initialized
   */
  const isInitialized = useCallback((): boolean => {
    return shaderSingleton.isInitialized();
  }, [shaderSingleton]);

  // Ensure cleanup when component unmounts
  useEffect(() => {
    return () => {
      // Release this hook's reference when unmounting
      releaseShader();
    };
  }, [releaseShader]);

  return {
    getShader,
    releaseShader,
    isInitialized,
  };
}
