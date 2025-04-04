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
 * Registry entry for a texture type
 */
export interface TextureRegistryEntry {
  /** Available texture handles for this type */
  handles: TextureHandle[];
  /** Default uniforms for this type */
  defaultUniforms: Record<string, TextureUniform>;
  /** Metadata for each texture input */
  inputs: TextureFieldMetadata[];
  /** Validates if a source texture type can be connected to a handle */
  validateConnection: (handle: TextureHandle, sourceType: string) => boolean;
}

// Create handles for add texture type
const addInput1Handle = createTextureHandle("input-1", "u_texture1");
const addInput2Handle = createTextureHandle("input-2", "u_texture2");

// Create handle for noise texture type
const noiseBlendHandle = createTextureHandle("input-1", "u_texture");

// Create handle for displace texture type
const displaceSourceHandle = createTextureHandle("input-1", "u_texture1");
const displaceMapHandle = createTextureHandle("input-2", "u_texture2");

// Create handle for limit texture type
const limitInputHandle = createTextureHandle("input-1", "u_texture");

// Ensure all handles were created successfully
if (
  !addInput1Handle ||
  !addInput2Handle ||
  !noiseBlendHandle ||
  !displaceSourceHandle ||
  !displaceMapHandle ||
  !limitInputHandle
) {
  throw new Error("Failed to create texture handles for registry");
}

/**
 * Create texture field metadata from uniform constraints
 */
function createTextureFieldMetadata(
  handle: TextureHandle,
  constraint: UniformFieldValue,
): TextureFieldMetadata {
  if (constraint.type !== ValueType.Texture) {
    throw new Error(`Invalid constraint type for handle ${handle.id}`);
  }
  const textureConstraint = constraint.constraint as TextureFieldMetadata;
  return {
    handle,
    description: textureConstraint.description || constraint.label,
    required: textureConstraint.required || false,
  };
}

// Ensure uniform constraints exist
if (
  !ADD_UNIFORM_CONSTRAINTS.u_texture1 ||
  !ADD_UNIFORM_CONSTRAINTS.u_texture2 ||
  !DISPLACE_UNIFORM_CONSTRAINTS.u_texture1 ||
  !DISPLACE_UNIFORM_CONSTRAINTS.u_texture2 ||
  !LIMIT_UNIFORM_CONSTRAINTS.u_texture ||
  !PNOISE_UNIFORM_CONSTRAINTS.u_texture
) {
  throw new Error("Required uniform constraints are missing");
}

/**
 * The main texture registry containing all registered texture types
 */
export const textureRegistry: Record<string, TextureRegistryEntry> = {
  Add: {
    handles: [addInput1Handle, addInput2Handle],
    defaultUniforms: {
      u_texture1: createTextureUniform(addInput1Handle, null),
      u_texture2: createTextureUniform(addInput2Handle, null),
    },
    inputs: [
      createTextureFieldMetadata(
        addInput1Handle,
        ADD_UNIFORM_CONSTRAINTS.u_texture1,
      ),
      createTextureFieldMetadata(
        addInput2Handle,
        ADD_UNIFORM_CONSTRAINTS.u_texture2,
      ),
    ],
    validateConnection: () => true, // Add accepts any texture type
  },
  Displace: {
    handles: [displaceSourceHandle, displaceMapHandle],
    defaultUniforms: {
      u_texture1: createTextureUniform(displaceSourceHandle, null),
      u_texture2: createTextureUniform(displaceMapHandle, null),
    },
    inputs: [
      createTextureFieldMetadata(
        displaceSourceHandle,
        DISPLACE_UNIFORM_CONSTRAINTS.u_texture1,
      ),
      createTextureFieldMetadata(
        displaceMapHandle,
        DISPLACE_UNIFORM_CONSTRAINTS.u_texture2,
      ),
    ],
    validateConnection: (handle: TextureHandle, sourceType: string) => {
      // Displace requires specific validation based on input
      if (handle.id === "input-1") {
        // Base texture can be any type
        return true;
      }
      // Displacement map should be a noise or gradient type
      return ["noise", "gradient"].includes(sourceType);
    },
  },
  Limit: {
    handles: [limitInputHandle],
    defaultUniforms: {
      u_texture: createTextureUniform(limitInputHandle, null),
    },
    inputs: [
      createTextureFieldMetadata(
        limitInputHandle,
        LIMIT_UNIFORM_CONSTRAINTS.u_texture,
      ),
    ],
    validateConnection: () => true, // Limit accepts any texture type
  },
  Noise: {
    handles: [noiseBlendHandle],
    defaultUniforms: {
      u_texture: createTextureUniform(noiseBlendHandle, null),
    },
    inputs: [
      createTextureFieldMetadata(
        noiseBlendHandle,
        PNOISE_UNIFORM_CONSTRAINTS.u_texture,
      ),
    ],
    validateConnection: () => true, // Noise accepts any texture for blending
  },
};

/**
 * Get texture field metadata for a specific texture type
 */
export function getTextureInputsForType(
  textureType: string,
): TextureFieldMetadata[] {
  return textureRegistry[textureType]?.inputs ?? [];
}

/**
 * Check if a handle is valid for a specific texture type
 */
export function isValidTextureHandleForType(
  textureType: string,
  handle: TextureHandle,
): boolean {
  const entry = textureRegistry[textureType];
  return (
    entry?.handles.some(
      (h) => h.id === handle.id && h.uniformName === handle.uniformName,
    ) ?? false
  );
}

/**
 * Check if a handle is required for a specific texture type
 */
export function isRequiredTextureHandle(
  textureType: string,
  handle: TextureHandle,
): boolean {
  const entry = textureRegistry[textureType];
  const input = entry?.inputs.find(
    (input) =>
      input.handle.id === handle.id &&
      input.handle.uniformName === handle.uniformName,
  );
  return input?.required ?? false;
}

/**
 * Get the handles for a specific texture type
 */
export function getTextureHandles(textureType: string): TextureHandle[] {
  return textureRegistry[textureType]?.handles ?? [];
}

/**
 * Get the default uniforms for a specific texture type
 */
export function getDefaultTextureUniforms(
  textureType: string,
): Record<string, TextureUniform> {
  return textureRegistry[textureType]?.defaultUniforms ?? {};
}
