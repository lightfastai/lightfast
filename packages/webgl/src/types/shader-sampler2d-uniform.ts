/**
 * Base interface for sampler2D handles in the WebGL layer.
 * This provides a clean abstraction for handle management without DB layer dependencies.
 */
export interface ShaderSampler2DUniform {
  /** Unique identifier for the texture handle */
  readonly handleId: string;
  /** Corresponding uniform name in the shader */
  readonly uniformName: string;
}

/**
 * Type guard to validate if a value is a Sampler2DHandle
 * @param value The value to check
 * @returns True if the value matches the Sampler2DHandle interface
 */
export function isSampler2DHandle(
  value: unknown,
): value is ShaderSampler2DUniform {
  return (
    typeof value === "object" &&
    value !== null &&
    "handleId" in value &&
    "uniformName" in value &&
    typeof value.handleId === "string" &&
    typeof value.uniformName === "string"
  );
}

/**
 * Validates if a handle's uniform name follows the expected format
 * @param uniformName The uniform name to validate
 * @returns True if the uniform name is valid
 */
export function isValidSampler2DUniformName(uniformName: string): boolean {
  return /^u_.*texture.*$/.test(uniformName) && uniformName.length > 2;
}

/**
 * Creates a Sampler2DHandle with validation
 * @param handleId The handle ID
 * @param uniformName The uniform name
 * @returns A Sampler2DHandle object or null if validation fails
 * @todo the error should be a custom error type for return
 */
export function createSampler2DHandle(
  handleId: string,
  uniformName: string,
): ShaderSampler2DUniform {
  if (!isValidSampler2DUniformName(uniformName)) {
    throw new Error(
      `Invalid uniform name: ${uniformName} for handleId: ${handleId}`,
    );
  }

  return {
    handleId,
    uniformName,
  };
}
