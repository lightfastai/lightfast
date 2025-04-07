import type * as THREE from "three";

import type { ShaderSampler2DUniform } from "./shader-sampler2d-uniform";

/**
 * Represents a texture uniform in the shader system
 */
export interface ShaderUniform {
  handle: ShaderSampler2DUniform | null;
  textureObject: THREE.Texture | null;
}

/**
 * Create a new TextureUniform with default values
 */
export function createShaderUniform(
  handle: ShaderSampler2DUniform | null = null,
  textureObject: THREE.Texture | null = null,
): ShaderUniform {
  return { handle, textureObject };
}

/**
 * Update an existing TextureUniform
 */
export function updateShaderUniform(
  uniform: ShaderUniform,
  handle: ShaderSampler2DUniform | null,
  textureObject: THREE.Texture | null,
): ShaderUniform {
  return { ...uniform, handle, textureObject };
}

/**
 * Check if a value is a TextureUniform
 */
export function isShaderUniform(value: unknown): value is ShaderUniform {
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
export function isShaderConnected(uniform: ShaderUniform): boolean {
  return !!uniform.handle;
}

/**
 * Get the uniform name from a texture uniform
 */
export function getShaderUniformName(uniform: ShaderUniform): string | null {
  return uniform.handle?.uniformName ?? null;
}
