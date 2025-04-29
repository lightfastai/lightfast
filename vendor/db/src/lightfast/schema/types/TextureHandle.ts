import { z } from "zod";

import {
  findUniformNameForHandleId,
  isValidSampler2DHandleId,
} from "@repo/webgl";

import type { TextureType } from "./Texture";

/**
 * Branded type for texture handle IDs
 */
export type InputHandleId = string & { readonly __brand: "InputHandleId" };

/**
 * Branded type for output handle IDs
 */
export type OutputHandleId = string & { readonly __brand: "OutputHandleId" };

/**
 * Regular expression for validating output handle IDs in the format "output-name"
 */
export const OUTPUT_HANDLE_ID_REGEX = /^output-[a-z0-9-]+$/;

/**
 * Check if a string is a valid texture handle ID
 */
export function isValidInputHandleId(id: string): boolean {
  return isValidSampler2DHandleId(id);
}

/**
 * Type guard for TextureHandleId
 */
export function isInputHandleId(value: unknown): value is InputHandleId {
  return typeof value === "string" && isValidInputHandleId(value);
}

/**
 * Map a texture handle ID to its corresponding uniform name
 *
 * @param handleId The texture handle ID
 * @param shaderType Optional shader type to look up in the registry (not used in this implementation)
 * @returns The corresponding uniform name or null if not found
 */
export function getUniformNameFromTextureHandleId(
  handleId: InputHandleId,
  textureType: TextureType,
): string | null {
  if (!isValidInputHandleId(handleId)) return null;

  // Note: In a future update, we could delegate to the WebGL utility
  // if we updated the architecture to allow for this dependency
  const uniformName = findUniformNameForHandleId(handleId, textureType);
  if (uniformName) return uniformName;

  return null;
}

// Update the Zod schema to use custom validation
export const $InputHandleId = z.custom<InputHandleId>(
  (val) => typeof val === "string" && isValidInputHandleId(val),
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
 * Check if a string is a valid output handle ID
 */
export function isValidOutputHandleId(id: string): boolean {
  return OUTPUT_HANDLE_ID_REGEX.test(id);
}

export function createInputHandleId(value: string): InputHandleId {
  if (!isValidInputHandleId(value))
    throw new Error(`Invalid handle ID: ${value}`);
  return value as InputHandleId;
}

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
