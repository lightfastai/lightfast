import type { Shaders } from "../shaders/enums/shaders";
import type { Sampler2DMetadata } from "../shaders/field";
import type { ShaderSampler2DUniformRegistry } from "./interfaces/sampler2d-registry-def";
import { generatedShaderRegistry } from "../generated/shader-registry.generated";
import {
  createSampler2DFieldMetadata,
  extractShaderSampler2DRegistry,
} from "./utils/sampler2d-utils";

/**
 * Registry of shader definitions
 * Populated from the generated registry
 */
export const shaderRegistry = generatedShaderRegistry;

/**
 * Check if a shader type is registered
 * @param type - The shader type
 * @returns True if registered, false otherwise
 */
export function isShaderRegistered(type: Shaders): boolean {
  return shaderRegistry.has(type);
}

/**
 * Get all registered shader types
 * @returns Array of registered shader types
 */
export function getAllShaderTypes(): Shaders[] {
  return Array.from(shaderRegistry.keys());
}

/**
 * The texture registry containing all registered texture types
 * Extracted from shader definitions
 */
export const textureInputRegistry: Record<
  Shaders,
  ShaderSampler2DUniformRegistry
> = Object.fromEntries(
  getAllShaderTypes().map((type) => {
    const definition = shaderRegistry.get(type);
    if (!definition) {
      throw new Error(`Shader definition not registered for type: ${type}`);
    }
    return [type, extractShaderSampler2DRegistry(definition)];
  }),
) as Record<Shaders, ShaderSampler2DUniformRegistry>;

/**
 * Get texture field metadata for a specific texture type
 */
export function getShaderSampler2DInputsForType(
  textureType: Shaders,
): Sampler2DMetadata[] {
  return textureInputRegistry[textureType].inputs;
}

// Re-export utility functions
export { createSampler2DFieldMetadata };
