import type { TextureFieldMetadata, UniformFieldValue } from "../types/field";
import type { TextureHandle } from "../types/handle";
import type { TextureUniform } from "../types/texture-uniform";
import { ADD_UNIFORM_CONSTRAINTS } from "../shaders/add";
import { DISPLACE_UNIFORM_CONSTRAINTS } from "../shaders/displace";
import { LIMIT_UNIFORM_CONSTRAINTS } from "../shaders/limit";
import { PNOISE_UNIFORM_CONSTRAINTS } from "../shaders/pnoise";
import { createTextureHandle } from "../types/handle";
import { ValueType } from "../types/schema";
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
 * Get a texture handle ID from a uniform name
 */
function getTextureHandleFromUniformName(uniformName: string): string {
  // If it's a format like u_texture1, extract the number
  const match = /^u_texture(\d+)$/.exec(uniformName);
  if (match?.[1]) {
    return `input-${match[1]}`;
  }

  // If it's a format like u_texture, use input-1
  if (uniformName === "u_texture") {
    return "input-1";
  }

  // Default fallback
  return "input-1";
}

/**
 * Create texture fields from uniform constraints
 */
function createTextureFieldsFromConstraints(
  constraints: Record<string, UniformFieldValue>,
): TextureFieldMetadata[] {
  return Object.entries(constraints)
    .filter(([_, value]) => value.type === ValueType.Texture)
    .map(([key, value]) => {
      const constraint = value.constraint as TextureFieldMetadata;
      const id = getTextureHandleFromUniformName(key);
      const handle = createTextureHandle(id, key);
      if (!handle) {
        throw new Error(`Failed to create texture handle for uniform ${key}`);
      }
      return {
        handle,
        description: constraint.description || value.label,
        required: constraint.required || false,
      };
    });
}

/**
 * The main texture registry containing all registered texture types
 */
export const textureRegistry: TextureRegistry = {
  Add: {
    fields: createTextureFieldsFromConstraints(ADD_UNIFORM_CONSTRAINTS),
    maxInputs: 2,
    validateConnection: (handle: TextureHandle, sourceType: string) => {
      // Add operation accepts any texture type
      return true;
    },
    createDefaultUniforms: () => ({
      u_texture1: createTextureUniform(null, null),
      u_texture2: createTextureUniform(null, null),
    }),
  },
  Displace: {
    fields: createTextureFieldsFromConstraints(DISPLACE_UNIFORM_CONSTRAINTS),
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
  Limit: {
    fields: createTextureFieldsFromConstraints(LIMIT_UNIFORM_CONSTRAINTS),
    maxInputs: 1,
    validateConnection: (handle: TextureHandle, sourceType: string) => {
      // Limit accepts any texture type
      return true;
    },
    createDefaultUniforms: () => ({
      u_texture1: createTextureUniform(null, null),
    }),
  },
  Noise: {
    fields: createTextureFieldsFromConstraints(PNOISE_UNIFORM_CONSTRAINTS),
    maxInputs: 1,
    validateConnection: (handle: TextureHandle, sourceType: string) => {
      // Noise accepts any texture type for displacement
      return true;
    },
    createDefaultUniforms: () => ({
      u_texture1: createTextureUniform(null, null),
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
