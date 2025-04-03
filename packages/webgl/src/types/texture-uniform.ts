import type * as THREE from "three";
import { z } from "zod";

/**
 * Represents a texture reference in the shader system
 */
export interface TextureReference {
  id: string | null; // The ID of the source texture node
  textureObject: THREE.Texture | null; // The actual WebGL/Three.js texture object
  isConnected: boolean; // Whether this texture input has a connection
}

/**
 * Zod schema for texture uniforms
 */
export const $TextureUniform = z
  .object({
    id: z.string().nullable(),
    textureObject: z.any().nullable(), // Can't strongly type THREE.Texture in Zod
    isConnected: z.boolean().default(false),
  })
  .nullable();

export type TextureUniform = z.infer<typeof $TextureUniform>;

/**
 * Factory function to create a texture uniform with description
 */
export function createTextureUniformSchema(description: string) {
  return $TextureUniform.describe(description);
}

/**
 * Check if a value is a TextureUniform
 */
export function isTextureUniform(value: unknown): value is TextureUniform {
  // Very simple check - in real implementation you might want to be more thorough
  return (
    value !== null &&
    typeof value === "object" &&
    "isConnected" in value &&
    "id" in value
  );
}

/**
 * Create a new TextureUniform with default values
 */
export function createTextureUniform(
  id: string | null = null,
  textureObject: THREE.Texture | null = null,
  isConnected = false,
): TextureUniform {
  return {
    id,
    textureObject,
    isConnected,
  };
}

/**
 * Update an existing TextureUniform
 */
export function updateTextureUniform(
  uniform: TextureUniform,
  id: string | null,
  textureObject: THREE.Texture | null,
  isConnected?: boolean,
): TextureUniform {
  if (!uniform) {
    return createTextureUniform(id, textureObject, isConnected ?? !!id);
  }

  return {
    ...uniform,
    id,
    textureObject,
    isConnected: isConnected ?? !!id,
  };
}
