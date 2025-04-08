import type {
  ShaderDefinition,
  ShaderSchema,
} from "@/shaders/interfaces/shader-impl";

import type { Shaders } from "../shaders/enums/shaders";

/**
 * Registry of shader definitions
 */
export const shaderRegistry = new Map<
  Shaders,
  ShaderDefinition<ShaderSchema>
>();

/**
 * Register a shader definition
 * @param definition - The shader definition to register
 */
export function registerShader<TSchema extends ShaderSchema>(
  definition: ShaderDefinition<TSchema>,
): void {
  shaderRegistry.set(definition.type, definition);
}

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
