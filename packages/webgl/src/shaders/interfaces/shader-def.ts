import type { z } from "zod";

import type { UniformFieldValue } from "../field";

/**
 * Generic type for Zod shader schema
 */
export type ShaderSchema = z.ZodObject<z.ZodRawShape>;

/**
 * Basic shader interface that doesn't depend on registry types
 * This represents the core shader information created in impl files
 */
export interface BaseShaderDefinition<
  TSchema extends ShaderSchema = ShaderSchema,
> {
  /** The shader type name */
  type: string;
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
 * Helper function to create a type-safe shader definition
 * @param type - Shader type name
 * @param vertexShader - Vertex shader code
 * @param fragmentShader - Fragment shader code
 * @param schema - Zod schema for validating shader uniforms
 * @param constraints - Uniform constraints for validation
 * @param createDefaultValues - Function to create default values for this shader
 * @returns A type-safe shader definition
 */
export function createBaseShaderDefinition<TSchema extends ShaderSchema>({
  type,
  vertexShader,
  fragmentShader,
  schema,
  constraints,
  createDefaultValues,
}: {
  type: string;
  vertexShader: string;
  fragmentShader: string;
  schema: TSchema;
  constraints: Record<keyof z.infer<TSchema> & string, UniformFieldValue>;
  createDefaultValues: () => z.infer<TSchema>;
}): BaseShaderDefinition<TSchema> {
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
 * Helper function to check if a value is a BaseShaderDefinition
 * @param value - The value to check
 * @returns True if the value is a BaseShaderDefinition, false otherwise
 */
export const isBaseShaderDefinition = (
  value: unknown,
): value is BaseShaderDefinition<ShaderSchema> => {
  return (
    typeof value === "object" &&
    value !== null &&
    "type" in value &&
    "vertexShader" in value &&
    "fragmentShader" in value &&
    "schema" in value &&
    "constraints" in value &&
    "createDefaultValues" in value
  );
};
