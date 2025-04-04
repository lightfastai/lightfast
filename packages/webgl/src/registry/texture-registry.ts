import type { TextureFieldMetadata } from "../types/field";
import type { TextureHandle } from "../types/handle";
import type { TextureUniform } from "../types/texture-uniform";
import { createTextureHandle } from "../types/handle";
import { createTextureUniform } from "../types/texture-uniform";

/**
 * Registry entry for a texture type, containing field metadata and validation rules
 */
export interface TextureRegistryEntry {
  /** Metadata for each texture field */
  fields: TextureFieldMetadata[];
  /** Maximum number of texture inputs allowed */
  maxInputs: number;
  /** Validates if a source texture type can be connected to a handle */
  validateConnection: (handle: TextureHandle, sourceType: string) => boolean;
  /** Creates default uniforms for this texture type */
  createDefaultUniforms: () => Record<string, TextureUniform>;
}

/**
 * Registry mapping texture types to their configuration
 */
export type TextureRegistry = Record<string, TextureRegistryEntry>;

/**
 * The main texture registry containing all registered texture types
 */
export const textureRegistry: TextureRegistry = {
  noise: {
    fields: [
      {
        handle: createTextureHandle("input-1", "u_texture1")!,
        description: "Displacement map",
        required: false,
      },
    ],
    maxInputs: 1,
    validateConnection: (handle: TextureHandle, sourceType: string) => {
      // Noise accepts any texture type
      return true;
    },
    createDefaultUniforms: () => ({
      u_texture1: createTextureUniform(null, null),
    }),
  },
  displace: {
    fields: [
      {
        handle: createTextureHandle("input-1", "u_texture1")!,
        description: "Base texture",
        required: true,
      },
      {
        handle: createTextureHandle("input-2", "u_texture2")!,
        description: "Displacement map",
        required: true,
      },
    ],
    maxInputs: 2,
    validateConnection: (handle: TextureHandle, sourceType: string) => {
      // Displace requires specific validation based on input
      if (handle.id === "input-1") {
        // Base texture can be any type
        return true;
      }
      // Displacement map should be a noise or gradient type
      return ["noise", "gradient"].includes(sourceType);
    },
    createDefaultUniforms: () => ({
      u_texture1: createTextureUniform(null, null),
      u_texture2: createTextureUniform(null, null),
    }),
  },
};

/**
 * Get texture field metadata for a specific texture type
 */
export function getTextureInputsForType(
  textureType: string,
): TextureFieldMetadata[] {
  return textureRegistry[textureType]?.fields ?? [];
}

/**
 * Check if a handle is valid for a specific texture type
 */
export function isValidTextureHandleForType(
  textureType: string,
  handle: TextureHandle,
): boolean {
  const fields = getTextureInputsForType(textureType);
  return fields.some(
    (field) =>
      field.handle.id === handle.id &&
      field.handle.uniformName === handle.uniformName,
  );
}

/**
 * Check if a handle is required for a specific texture type
 */
export function isRequiredTextureHandle(
  textureType: string,
  handle: TextureHandle,
): boolean {
  const fields = getTextureInputsForType(textureType);
  const field = fields.find(
    (field) =>
      field.handle.id === handle.id &&
      field.handle.uniformName === handle.uniformName,
  );
  return field?.required ?? false;
}

/**
 * Get the maximum number of texture inputs for a specific texture type
 */
export function getMaxTextureInputs(textureType: string): number {
  return textureRegistry[textureType]?.maxInputs ?? 0;
}

/**
 * Get the maximum number of texture inputs across all texture types
 */
export function getMaxTextureInputsAcrossAllTypes(): number {
  return Math.max(
    ...Object.values(textureRegistry).map((entry) => entry.maxInputs),
  );
}
