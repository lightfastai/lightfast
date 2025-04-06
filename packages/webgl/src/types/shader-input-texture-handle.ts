/**
 * Base interface for texture handles in the WebGL layer.
 * This provides a clean abstraction for handle management without DB layer dependencies.
 */
export interface ShaderInputTextureUniform {
  /** Unique identifier for the texture handle */
  readonly id: string;
  /** Corresponding uniform name in the shader */
  readonly uniformName: string;
}

/**
 * Type guard to validate if a value is a TextureHandle
 * @param value The value to check
 * @returns True if the value matches the TextureHandle interface
 */
export function isShaderInputTextureHandle(
  value: unknown,
): value is ShaderInputTextureUniform {
  return (
    typeof value === "object" &&
    value !== null &&
    "id" in value &&
    "uniformName" in value &&
    typeof value.id === "string" &&
    typeof value.uniformName === "string"
  );
}

/**
 * Validates if a handle's uniform name follows the expected format
 * @param uniformName The uniform name to validate
 * @returns True if the uniform name is valid
 */
export function isValidShaderInputUniformName(uniformName: string): boolean {
  return /^u_.*texture.*$/.test(uniformName);
}

/**
 * Creates a TextureHandle with validation
 * @param id The handle ID
 * @param uniformName The uniform name
 * @returns A TextureHandle object or null if validation fails
 */
export function createShaderInputTextureHandle(
  id: string,
  uniformName: string,
): ShaderInputTextureUniform {
  if (!isValidShaderInputUniformName(uniformName)) {
    throw new Error(`Invalid uniform name: ${uniformName}`);
  }

  return {
    id,
    uniformName,
  };
}
