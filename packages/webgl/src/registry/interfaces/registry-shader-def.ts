import type { Shaders } from "../../generated/shader-enum.generated";
import type {
  BaseShaderDefinition,
  ShaderSchema,
} from "../../shaders/interfaces/shader-def";

/**
 * Interface that defines all the necessary components for a registry shader
 * This extends the base shader definition with registry-specific typing (Shaders enum)
 */
export interface ShaderDefinition<TSchema extends ShaderSchema = ShaderSchema>
  extends Omit<BaseShaderDefinition<TSchema>, "type"> {
  /** The shader type from the registry enum */
  type: Shaders;
}

/**
 * Helper function to adapt a BaseShaderDefinition to a registry ShaderDefinition
 * @param baseDefinition - The base shader definition
 * @param shaderType - The shader type from the registry enum
 * @returns A registry shader definition
 */
export function adaptToRegistryDefinition<TSchema extends ShaderSchema>(
  baseDefinition: BaseShaderDefinition<TSchema>,
  shaderType: Shaders,
): ShaderDefinition<TSchema> {
  return {
    ...baseDefinition,
    type: shaderType,
  };
}

/**
 * Helper function to check if a value is a ShaderDefinition
 * @param value - The value to check
 * @returns True if the value is a ShaderDefinition, false otherwise
 */
export const isShaderDefinition = (
  value: unknown,
): value is ShaderDefinition<ShaderSchema> => {
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
