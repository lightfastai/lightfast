"use client";

import type * as THREE from "three";
import { useCallback, useEffect, useRef } from "react";

import { noiseShaderSingleton } from "../shaders/pnoise-shader-singleton";

interface NoiseShaderMaterialOrchestrator {
  /**
   * Acquires the shared noise shader material.
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

// Global reference counter for the singleton
let globalRefCount = 0;

/**
 * Hook to manage the lifecycle of the noise shader singleton.
 * Provides methods to acquire and release the shader with automatic cleanup.
 * Uses reference counting to ensure proper disposal when no longer needed.
 */
export function useNoiseShaderMaterialOrchestrator(): NoiseShaderMaterialOrchestrator {
  // Reference to track if this hook instance has acquired the shader
  const hasReference = useRef<boolean>(false);

  /**
   * Gets the shader and increases the reference count
   */
  const getShader = useCallback((): THREE.ShaderMaterial => {
    // Increment global reference count
    if (!hasReference.current) {
      globalRefCount++;
      hasReference.current = true;
    }

    // Get or create the shader from singleton
    return noiseShaderSingleton.getInstance();
  }, []);

  /**
   * Releases this hook's reference to the shader
   * When the global reference count reaches zero, the shader is disposed
   */
  const releaseShader = useCallback((): void => {
    if (hasReference.current) {
      // Decrement reference count
      globalRefCount--;
      hasReference.current = false;

      // If no more references exist, dispose the shader
      if (globalRefCount === 0 && noiseShaderSingleton.isInitialized()) {
        noiseShaderSingleton.dispose();
      }
    }
  }, []);

  /**
   * Checks if the shader is currently initialized
   */
  const isInitialized = useCallback((): boolean => {
    return noiseShaderSingleton.isInitialized();
  }, []);

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
