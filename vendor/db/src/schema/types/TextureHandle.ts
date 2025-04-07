import { z } from "zod";

/**
 * Branded type for texture handle IDs
 */
export type TextureHandleId = string & { readonly __brand: "TextureHandleId" };

/**
 * Branded type for output handle IDs
 */
export type OutputHandleId = string & { readonly __brand: "OutputHandleId" };

/**
 * Union type for all handle IDs
 */
export type HandleId = TextureHandleId | OutputHandleId;

/**
 * Regular expression for validating texture handle IDs in the format "input-N"
 */
export const TEXTURE_HANDLE_ID_REGEX = /^input-\d+$/;

/**
 * Regular expression for validating output handle IDs in the format "output-name"
 */
export const OUTPUT_HANDLE_ID_REGEX = /^output-[a-z0-9-]+$/;

/**
 * DB layer implementation of the TextureHandle interface
 */
export interface TextureHandleImpl {
  readonly id: TextureHandleId;
  readonly uniformName: string;
}

/**
 * Check if a string is a valid texture handle ID
 */
export function isValidTextureHandleId(id: string): boolean {
  return TEXTURE_HANDLE_ID_REGEX.test(id);
}

/**
 * Type guard for TextureHandleId
 */
export function isTextureHandleId(value: unknown): value is TextureHandleId {
  return typeof value === "string" && isValidTextureHandleId(value);
}

/**
 * Get the numeric index from a texture handle ID
 */
export function getTextureHandleIndex(handleId: string): number | null {
  if (!isValidTextureHandleId(handleId)) return null;
  const match = /^input-(\d+)$/.exec(handleId);
  if (!match?.[1]) return null;
  return parseInt(match[1], 10) - 1; // Convert to zero-based index
}

/**
 * Map a texture handle ID to its corresponding uniform name
 */
export function getUniformNameFromTextureHandleId(
  handleId: string | TextureHandleId,
): string | null {
  if (!isValidTextureHandleId(handleId)) return null;
  const index = getTextureHandleIndex(handleId);
  if (index === null) return null;
  return `u_texture${index}`;
}

/**
 * Create a TextureHandle with validation
 */
export function createTextureHandle(value: string): TextureHandle | null {
  const handleId = value as TextureHandleId;
  if (!isValidTextureHandleId(handleId)) return null;

  const uniformName = getUniformNameFromTextureHandleId(handleId);
  if (!uniformName) return null;

  return {
    id: handleId,
    uniformName,
  };
}

/**
 * Map a uniform name to its corresponding texture handle ID
 */
export function getTextureHandleFromUniformName(
  uniformName: string,
): TextureHandle | null {
  const match = /^u_texture(\d+)$/.exec(uniformName);
  if (!match?.[1]) return null;
  const index = parseInt(match[1], 10);
  const handleId = `input-${index}` as TextureHandleId;
  return createTextureHandle(handleId);
}

/**
 * Zod schema for texture handles
 */
export const $TextureHandle = z.object({
  id: z.string().refine(isValidTextureHandleId),
  uniformName: z.string().regex(/^u_.*texture.*$/),
});

// Update the Zod schema to use custom validation
export const $TextureHandleId = z.custom<TextureHandleId>(
  (val) => typeof val === "string" && isValidTextureHandleId(val),
  {
    message:
      "Handle ID must be in the format 'input-N' where N is a positive integer",
  },
);

// New: Zod schema for OutputHandleId
export const $OutputHandleId = z.custom<OutputHandleId>(
  (val) => typeof val === "string" && isValidOutputHandleId(val),
  {
    message: "Output handle ID must be in the format 'output-name'",
  },
);

/**
 * Union type Zod schema for all handle ID types
 */
export const $HandleId = z.union([$TextureHandleId, $OutputHandleId]);

/**
 * Check if a string is a valid output handle ID
 */
export function isValidOutputHandleId(id: string): boolean {
  return OUTPUT_HANDLE_ID_REGEX.test(id);
}

/**
 * Safe constructor function that validates and creates a TextureHandleId
 * @param value The string value to validate and convert
 * @returns A TextureHandleId
 * @throws Error if the value is not a valid handle ID
 */
export function createTextureHandleId(value: string): TextureHandleId {
  if (!isValidTextureHandleId(value))
    throw new Error(`Invalid handle ID: ${value}`);
  return value as TextureHandleId;
}

/**
 * Safe constructor function that validates and creates an OutputHandleId
 * @param value The string value to validate and convert
 * @returns An OutputHandleId
 * @throws Error if the value is not a valid handle ID
 */
export function createOutputHandleId(value: string): OutputHandleId {
  if (!isValidOutputHandleId(value))
    throw new Error(`Invalid handle ID: ${value}`);
  return value as OutputHandleId;
}

/**
 * Type guard for OutputHandleId
 * @param value The value to check
 * @returns True if the value is a valid OutputHandleId
 */
export function isOutputHandleId(value: unknown): value is OutputHandleId {
  return typeof value === "string" && isValidOutputHandleId(value);
}
