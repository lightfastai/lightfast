import type {
  ShaderDefinition,
  ShaderSchema,
} from "@/shaders/interfaces/shader-impl";

import type { Shaders } from "../generated/shader-enum.generated";
import { generatedShaderRegistry } from "../generated/shader-registry.generated";

/**
 * Registry of shader definitions
 * Populated from the generated registry
 */
export const shaderRegistry = generatedShaderRegistry;

/**
 * Get a shader definition
 * @param type - The shader type
 * @returns The shader definition
 * @throws Error if shader type is not registered
 */
export function getShaderDefinition(
  type: Shaders,
): ShaderDefinition<ShaderSchema> {
  const definition = shaderRegistry.get(type);

  if (!definition) {
    throw new Error(`Shader definition not registered for type: ${type}`);
  }

  return definition;
}

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
