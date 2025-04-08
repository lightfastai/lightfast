"use client";

import type * as THREE from "three";
import { useCallback, useEffect, useMemo, useRef } from "react";

import type { Shaders } from "@repo/webgl";
import { getAllShaderTypes } from "@repo/webgl";

import { ShaderSingletonRegistry } from "./shader-registry";

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

export type ShaderOrchestratorMap = Record<Shaders, ShaderMaterialOrchestrator>;

/**
 * Global map to track reference counts for different shader singletons
 * Keys are unique identifiers for each shader type
 */
const globalShaderRefCounts = new Map<string, number>();

/**
 * Hook to get a shader orchestrator for a specific shader type
 * @param shaderKey The shader type
 * @returns The shader orchestrator for the given type
 */
export const useShaderOrchestrator = (
  shaderKey: Shaders,
): ShaderMaterialOrchestrator => {
  // Reference to track if this hook instance has acquired the shader
  const hasReference = useRef<boolean>(false);
  const shaderSingleton = ShaderSingletonRegistry.getSingleton(shaderKey);

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
};

/**
 * Hook to get a map of shader orchestrators for all available shader types
 * This centralizes shader orchestrator creation and ensures proper React Hooks usage
 * @returns A map of shader orchestrators, with shader types as keys
 */
export const useShaderOrchestratorMap = (): ShaderOrchestratorMap => {
  // Get all available shader types
  const shaderTypes = useMemo(() => getAllShaderTypes(), []);

  // Create an orchestrator for each shader type using a reducer
  const orchestrators = shaderTypes.reduce<
    Record<string, ShaderMaterialOrchestrator>
  >((acc, shaderType) => {
    // Use the existing useShaderOrchestrator hook for each type
    acc[shaderType] = useShaderOrchestrator(shaderType);
    return acc;
  }, {});

  // Return the map, memoized to prevent unnecessary rerenders
  return useMemo(() => {
    return orchestrators as ShaderOrchestratorMap;
  }, [orchestrators]);
};
