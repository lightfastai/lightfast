import type { Shaders } from "@/types/shaders";

import type { HandleMetadata, UniformFieldValue } from "../types/field";
import type { ShaderSampler2DUniform } from "../types/shader-sampler2d-uniform";
import {
  ADD_UNIFORM_CONSTRAINTS,
  addInput1Handle,
  addInput2Handle,
} from "../shaders/add";
import {
  DISPLACE_UNIFORM_CONSTRAINTS,
  displaceMapHandle,
  displaceSourceHandle,
} from "../shaders/displace";
import { LIMIT_UNIFORM_CONSTRAINTS, limitInputHandle } from "../shaders/limit";
import {
  noiseBlendHandle,
  PNOISE_UNIFORM_CONSTRAINTS,
} from "../shaders/pnoise";
import { ValueType } from "../types/schema";

/**
 * Registry entry for a texture type
 */
export interface ShaderSampler2DRegistry {
  /** Available texture handles for this type */
  handles: ShaderSampler2DUniform[];
  /** Default uniforms for this type */
  defaultUniforms: Record<string, ShaderSampler2DUniform>;
  /** Metadata for each texture input */
  inputs: HandleMetadata[];
  /** Validates if a source texture type can be connected to a handle */
  validateConnection: (
    handle: ShaderSampler2DUniform,
    sourceType: string,
  ) => boolean;
}

/**
 * Create texture field metadata from uniform constraints
 */
function createTextureFieldMetadata(
  handle: ShaderSampler2DUniform,
  constraint: UniformFieldValue,
): HandleMetadata {
  if (constraint.type !== ValueType.Texture) {
    throw new Error(`Invalid constraint type for handle ${handle.handleId}`);
  }
  const textureConstraint = constraint.constraint as HandleMetadata;
  return {
    handle,
    description: textureConstraint.description || constraint.label,
    required: textureConstraint.required || false,
  };
}

// Ensure uniform constraints exist
// @todo ensure typesafety...
if (
  !ADD_UNIFORM_CONSTRAINTS.u_texture1 ||
  !ADD_UNIFORM_CONSTRAINTS.u_texture2 ||
  !DISPLACE_UNIFORM_CONSTRAINTS.u_texture1 ||
  !DISPLACE_UNIFORM_CONSTRAINTS.u_texture2 ||
  !LIMIT_UNIFORM_CONSTRAINTS.u_texture1 ||
  !PNOISE_UNIFORM_CONSTRAINTS.u_texture1
) {
  throw new Error("Required uniform constraints are missing");
}

/**
 * The main texture registry containing all registered texture types
 */
export const textureInputRegistry: Record<Shaders, ShaderSampler2DRegistry> = {
  Add: {
    handles: [addInput1Handle, addInput2Handle],
    defaultUniforms: {
      u_texture1: addInput1Handle,
      u_texture2: addInput2Handle,
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
      u_texture1: displaceSourceHandle,
      u_texture2: displaceMapHandle,
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
    validateConnection: (
      handle: ShaderSampler2DUniform,
      sourceType: string,
    ) => {
      // Displace requires specific validation based on input
      if (handle.handleId === "input-1") {
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
      u_texture1: limitInputHandle,
    },
    inputs: [
      createTextureFieldMetadata(
        limitInputHandle,
        LIMIT_UNIFORM_CONSTRAINTS.u_texture1,
      ),
    ],
    validateConnection: () => true, // Limit accepts any texture type
  },
  Noise: {
    handles: [noiseBlendHandle],
    defaultUniforms: {
      u_texture1: noiseBlendHandle,
    },
    inputs: [
      createTextureFieldMetadata(
        noiseBlendHandle,
        PNOISE_UNIFORM_CONSTRAINTS.u_texture1,
      ),
    ],
    validateConnection: () => true, // Noise accepts any texture for blending
  },
};

/**
 * Get texture field metadata for a specific texture type
 */
export function getShaderSampler2DInputsForType(
  textureType: Shaders,
): HandleMetadata[] {
  return textureInputRegistry[textureType].inputs;
}

/**
 * Check if a handle is valid for a specific texture type
 */
export function isValidSampler2DHandleForType(
  textureType: Shaders,
  handle: ShaderSampler2DUniform,
): boolean {
  const entry = textureInputRegistry[textureType];
  return entry.handles.some(
    (h) =>
      h.handleId === handle.handleId && h.uniformName === handle.uniformName,
  );
}

/**
 * Check if a handle is required for a specific texture type
 */
export function isRequiredSampler2DHandleForType(
  textureType: Shaders,
  handle: ShaderSampler2DUniform,
): boolean {
  const entry = textureInputRegistry[textureType];
  const input = entry.inputs.find(
    (input) =>
      input.handle.handleId === handle.handleId &&
      input.handle.uniformName === handle.uniformName,
  );
  return input?.required ?? false;
}

/**
 * Get the handles for a specific texture type
 */
export function getSampler2DHandlesForType(
  textureType: Shaders,
): ShaderSampler2DUniform[] {
  return textureInputRegistry[textureType].handles;
}

/**
 * Get the default uniforms for a specific texture type
 */
export function getDefaultSampler2DHandlesForType(
  textureType: Shaders,
): Record<string, ShaderSampler2DUniform> {
  return textureInputRegistry[textureType].defaultUniforms;
}
