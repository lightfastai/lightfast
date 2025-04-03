import { z } from "zod";

import { getTextureInputsForType } from "@repo/webgl";

// Regular expression for validating handle IDs in the format "input-N"
export const TEXTURE_HANDLE_ID_REGEX = /^input-\d+$/;

// Zod schema for validating texture handle IDs
export const $TextureHandleId = z.string().regex(TEXTURE_HANDLE_ID_REGEX, {
  message:
    "Handle ID must be in the format 'input-N' where N is a positive integer",
});

export type TextureHandleId = z.infer<typeof $TextureHandleId>;

/**
 * Check if a string is a valid texture handle ID
 */
export function isValidTextureHandleId(id: string): boolean {
  return TEXTURE_HANDLE_ID_REGEX.test(id);
}

/**
 * Helper function to generate a handle ID from an index
 */
export function generateTextureHandleId(index: number): TextureHandleId {
  return `input-${index + 1}`; // Convert from zero-based to one-based
}

/**
 * Helper function to get the numeric index from a handle ID
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
  handleId: string,
): string | null {
  if (!isValidTextureHandleId(handleId)) return null;
  const index = getTextureHandleIndex(handleId);
  if (index === null) return null;
  return `u_texture${index + 1}`;
}

/**
 * Map a uniform name to its corresponding texture handle ID
 */
export function getTextureHandleIdFromUniformName(
  uniformName: string,
): TextureHandleId | null {
  const match = /^u_texture(\d+)$/.exec(uniformName);
  if (!match?.[1]) return null;
  const index = parseInt(match[1], 10);
  return generateTextureHandleId(index - 1); // Convert from one-based to zero-based indexing
}

/**
 * Get metadata about texture inputs for a specific texture type
 * This now delegates to the registry's getTextureInputsForType function
 */
export function getTextureInputsMetadata(textureType: string): {
  id: string;
  uniformName: string;
  description: string;
  required: boolean;
}[] {
  // Delegate to the registry function
  return getTextureInputsForType(textureType);
}
