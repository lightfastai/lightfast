import type { Shaders } from "../shaders/enums/shaders";
import type { Sampler2DMetadata, UniformFieldValue } from "../shaders/field";
import type { Sampler2DHandle } from "../uniforms/handle";
import type { ShaderSampler2DUniformRegistry } from "./interfaces/sampler2d-registry-def";
import { $ValueType } from "../shaders/enums/values";
import {
  ADD_UNIFORM_CONSTRAINTS,
  addInput1Handle,
  addInput2Handle,
} from "../shaders/impl/add";
import {
  DISPLACE_UNIFORM_CONSTRAINTS,
  displaceMapHandle,
  displaceSourceHandle,
} from "../shaders/impl/displace";
import {
  LIMIT_UNIFORM_CONSTRAINTS,
  limitInputHandle,
} from "../shaders/impl/limit";
import {
  noiseBlendHandle,
  PNOISE_UNIFORM_CONSTRAINTS,
} from "../shaders/impl/pnoise";

/**
 * Create sampler2D field metadata from uniform constraints
 */
export function createSampler2DFieldMetadata(
  handle: Sampler2DHandle,
  constraint: UniformFieldValue,
): Sampler2DMetadata {
  if (constraint.type !== $ValueType.enum.Sampler2D) {
    throw new Error(`Invalid constraint type for handle ${handle.handleId}`);
  }
  return {
    handle,
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
export const textureInputRegistry: Record<
  Shaders,
  ShaderSampler2DUniformRegistry
> = {
  Add: {
    handles: [addInput1Handle, addInput2Handle],
    defaultUniforms: {
      u_texture1: addInput1Handle,
      u_texture2: addInput2Handle,
    },
    inputs: [
      createSampler2DFieldMetadata(
        addInput1Handle,
        ADD_UNIFORM_CONSTRAINTS.u_texture1,
      ),
      createSampler2DFieldMetadata(
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
      createSampler2DFieldMetadata(
        displaceSourceHandle,
        DISPLACE_UNIFORM_CONSTRAINTS.u_texture1,
      ),
      createSampler2DFieldMetadata(
        displaceMapHandle,
        DISPLACE_UNIFORM_CONSTRAINTS.u_texture2,
      ),
    ],
    validateConnection: () => true, // Displace accepts any texture type
  },
  Limit: {
    handles: [limitInputHandle],
    defaultUniforms: {
      u_texture1: limitInputHandle,
    },
    inputs: [
      createSampler2DFieldMetadata(
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
      createSampler2DFieldMetadata(
        noiseBlendHandle,
        PNOISE_UNIFORM_CONSTRAINTS.u_texture1,
      ),
    ],
    validateConnection: () => true, // Pnoise accepts any texture for blending
  },
  Migrated: {
    handles: [],
    defaultUniforms: {},
    inputs: [],
    validateConnection: () => true, // Migrated example
  },
};

/**
 * Get texture field metadata for a specific texture type
 */
export function getShaderSampler2DInputsForType(
  textureType: Shaders,
): Sampler2DMetadata[] {
  return textureInputRegistry[textureType].inputs;
}
