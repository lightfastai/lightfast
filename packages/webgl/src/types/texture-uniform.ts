import type * as THREE from "three";

import type { TextureHandle } from "./handle";

/**
 * Represents a texture uniform in the shader system
 */
export interface TextureUniform {
  handle: TextureHandle | null;
  textureObject: THREE.Texture | null;
}

/**
 * Create a new TextureUniform with default values
 */
export function createTextureUniform(
  handle: TextureHandle | null = null,
  textureObject: THREE.Texture | null = null,
): TextureUniform {
  return { handle, textureObject };
}

/**
 * Update an existing TextureUniform
 */
export function updateTextureUniform(
  uniform: TextureUniform,
  handle: TextureHandle | null,
  textureObject: THREE.Texture | null,
): TextureUniform {
  return { ...uniform, handle, textureObject };
}

/**
 * Check if a value is a TextureUniform
 */
export function isTextureUniform(value: unknown): value is TextureUniform {
  return (
    value !== null &&
    typeof value === "object" &&
    "handle" in value &&
    "textureObject" in value
  );
}

/**
 * Check if a texture uniform has a connection
 */
export function isTextureConnected(uniform: TextureUniform): boolean {
  return !!uniform.handle;
}

/**
 * Get the uniform name from a texture uniform
 */
export function getUniformName(uniform: TextureUniform): string | null {
  return uniform.handle?.uniformName ?? null;
}
