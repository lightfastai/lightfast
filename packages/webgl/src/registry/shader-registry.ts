import type { z } from "zod";

import type { UniformFieldValue } from "../types/field";
import type { Shaders } from "../types/shaders-types";

/**
 * Generic type for Zod shader schema
 */
export type ShaderSchema = z.ZodObject<z.ZodRawShape>;

/**
 * Interface that defines all the necessary components for a shader
 */
export interface ShaderDefinition<TSchema extends ShaderSchema = ShaderSchema> {
  /** The shader type */
  type: Shaders;
  /** The vertex shader code */
  vertexShader: string;
  /** The fragment shader code */
  fragmentShader: string;
  /** Zod schema for validating shader uniforms */
  schema: TSchema;
  /** Uniform constraints for validation */
  constraints: Record<keyof z.infer<TSchema> & string, UniformFieldValue>;
  /** Function to create default values for this shader */
  createDefaultValues: () => z.infer<TSchema>;
}

/**
 * Registry of shader definitions
 */
export const shaderRegistry = new Map<
  Shaders,
  ShaderDefinition<ShaderSchema>
>();

/**
 * Helper function to create a type-safe shader definition
 * @param type - Shader type
 * @param vertexShader - Vertex shader code
 * @param fragmentShader - Fragment shader code
 * @param schema - Zod schema for validating shader uniforms
 * @param constraints - Uniform constraints for validation
 * @param createDefaultValues - Function to create default values for this shader
 * @returns A type-safe shader definition
 */
export function createShaderDefinition<TSchema extends ShaderSchema>(
  type: Shaders,
  vertexShader: string,
  fragmentShader: string,
  schema: TSchema,
  constraints: Record<keyof z.infer<TSchema> & string, UniformFieldValue>,
  createDefaultValues: () => z.infer<TSchema>,
): ShaderDefinition<TSchema> {
  return {
    type,
    vertexShader,
    fragmentShader,
    schema,
    constraints,
    createDefaultValues,
  };
}

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
