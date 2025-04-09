/**
 * Registry entry for a texture type
 */

import type { Sampler2DMetadata } from "../../shaders/field";
import type { Sampler2DHandle } from "../../shaders/interfaces/sampler2d-handle";

export interface ShaderSampler2DUniformRegistry {
  /** Available texture handles for this type */
  handles: Sampler2DHandle[];
  /** Default uniforms for this type */
  defaultUniforms: Record<string, Sampler2DHandle>;
  /** Metadata for each texture input */
  inputs: Sampler2DMetadata[];
  /** Validates if a source texture type can be connected to a handle */
  validateConnection: (handle: Sampler2DHandle, sourceType: string) => boolean;
}
