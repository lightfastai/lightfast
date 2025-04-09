/**
 * Base interface for sampler2D handles in the WebGL layer.
 * This provides a clean abstraction for handle management without DB layer dependencies.
 */
export interface Sampler2DHandle {
  /** Unique identifier for the texture handle */
  readonly handleId: string;
  /** Corresponding uniform name in the shader */
  readonly uniformName: string;
  /** Description of the texture handle */
  readonly description: string;
}

/**
 * Validates if a handle's uniform name follows the expected format
 * @param uniformName The uniform name to validate
 * @returns True if the uniform name is valid
 */
export function isValidSampler2DUniformName(uniformName: string): boolean {
  return /^u_.*texture.*$/.test(uniformName) && uniformName.length > 2;
}

export function isValidSampler2DHandleId(handleId: string): boolean {
  return /^input-\d+$/.test(handleId);
}

/**
 * Creates a Sampler2DHandle with validation
 * @param handleId The handle ID
 * @param uniformName The uniform name
 * @param description The description of the texture handle
 * @returns A Sampler2DHandle object or null if validation fails
 * @todo the error should be a custom error type for return
 */
export function createSampler2DHandle(
  handleId: string,
  uniformName: string,
  description?: string,
): Sampler2DHandle {
  if (!isValidSampler2DUniformName(uniformName)) {
    throw new Error(
      `Invalid uniform name: ${uniformName} for handleId: ${handleId}`,
    );
  }

  if (!isValidSampler2DHandleId(handleId)) {
    throw new Error(`Invalid handleId: ${handleId}`);
  }

  return {
    handleId,
    uniformName,
    description: description ?? "",
  };
}
