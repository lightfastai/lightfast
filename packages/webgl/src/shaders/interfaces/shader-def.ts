import type { z } from "zod";

import type { UniformFieldValue } from "../field";
import type { Sampler2DHandle } from "./sampler2d-handle";

/**
 * Generic type for Zod shader schema
 */
export type ShaderSchema = z.ZodObject<z.ZodRawShape>;

/**
 * Texture handles information for a shader
 */
export interface ShaderTextureHandles {
  /** Available texture handles for this type */
  handles: Sampler2DHandle[];
  /** Default uniform mapping to handles */
  defaultUniformMapping: Record<string, Sampler2DHandle>;
  /** Function to validate if a source texture type can be connected to a handle */
  validateConnection?: (handle: Sampler2DHandle, sourceType: string) => boolean;
}

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
  /** Texture handles information for the shader (optional) */
  textureHandles?: ShaderTextureHandles;
}

/**
 * Helper function to create a type-safe shader definition
 * @param type - Shader type name
 * @param vertexShader - Vertex shader code
 * @param fragmentShader - Fragment shader code
 * @param schema - Zod schema for validating shader uniforms
 * @param constraints - Uniform constraints for validation
 * @param textureHandles - Texture handles information (optional)
 * @returns A type-safe shader definition
 */
export function createBaseShaderDefinition<TSchema extends ShaderSchema>({
  type,
  vertexShader,
  fragmentShader,
  schema,
  constraints,
  textureHandles,
}: {
  type: string;
  vertexShader: string;
  fragmentShader: string;
  schema: TSchema;
  constraints: Record<keyof z.infer<TSchema> & string, UniformFieldValue>;
  textureHandles?: ShaderTextureHandles;
}): BaseShaderDefinition<TSchema> {
  return {
    type,
    vertexShader,
    fragmentShader,
    schema,
    constraints,
    textureHandles,
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
    "constraints" in value
  );
};
