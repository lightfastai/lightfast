"use client";

import type { ShaderMaterial } from "three";
import { useCallback } from "react";
import * as THREE from "three";

import type { Sampler2D } from "@repo/webgl";
import { isSampler2D } from "@repo/webgl";

import { Sampler2DAdapterFactory } from "../types/sampler2d-adapter";

/**
 * Type for texture mapping to ensure type safety
 */
type TextureMapping = Record<string, THREE.Texture | null>;

/**
 * Hook for handling Sampler2D uniforms in shaders
 * Provides utilities for updating texture uniforms in a consistent way
 */
export function useSampler2D() {
  /**
   * Updates a Sampler2D uniform in a shader material
   * @param shader The shader material to update
   * @param uniformName The name of the uniform to update
   * @param value The Sampler2D value or texture to use
   * @param textureResolver Optional function to resolve a Sampler2D to a texture
   */
  const updateSampler2DUniform = useCallback(
    (
      shader: ShaderMaterial,
      uniformName: string,
      value: Sampler2D | THREE.Texture | null,
      textureResolver?: (sampler: Sampler2D) => THREE.Texture | null,
    ) => {
      // Skip if the uniform doesn't exist in the shader
      if (!shader.uniforms[uniformName]) return;

      // If it's already a THREE.Texture or null, assign directly
      if (value instanceof THREE.Texture || value === null) {
        shader.uniforms[uniformName].value = value;
        return;
      }

      // If it's a Sampler2D object, use the adapter
      if (isSampler2D(value)) {
        const adapter = Sampler2DAdapterFactory.getAdapter();
        shader.uniforms[uniformName] = adapter.toThreeUniform(
          value,
          textureResolver,
        );
      }
    },
    [],
  );

  /**
   * Updates multiple Sampler2D uniforms at once
   * @param shader The shader material to update
   * @param textureMap Map of uniform names to textures or Sampler2D objects
   * @param textureResolver Optional function to resolve Sampler2D objects to textures
   */
  const updateSampler2DUniforms = useCallback(
    (
      shader: ShaderMaterial,
      textureMap: Record<string, Sampler2D | THREE.Texture | null>,
      textureResolver?: (sampler: Sampler2D) => THREE.Texture | null,
    ) => {
      for (const [uniformName, value] of Object.entries(textureMap)) {
        updateSampler2DUniform(shader, uniformName, value, textureResolver);
      }
    },
    [updateSampler2DUniform],
  );

  /**
   * Creates a texture resolver function from a mapping
   */
  const createTextureResolver = useCallback(
    (textureMapping: TextureMapping) => {
      return (sampler: Sampler2D): THREE.Texture | null => {
        if (sampler.vuvID === null) {
          return null;
        }

        // Convert to string to ensure it works as an index
        const key = String(sampler.vuvID);

        // Use a direct null fallback
        return textureMapping[key] ?? null;
      };
    },
    [],
  );

  return {
    updateSampler2DUniform,
    updateSampler2DUniforms,
    createTextureResolver,
  };
}
