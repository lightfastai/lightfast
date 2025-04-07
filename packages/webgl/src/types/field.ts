/**
 * Defines constraints and validation rules for shader uniform values.
 * These types are used to specify the valid ranges and step sizes for uniform parameters.
 */

import type { ShaderSampler2DUniform } from "./shader-sampler2d-uniform";
import type { ValueType } from "./uniforms";

export interface ValueFieldMetadata {
  min: number;
  max: number;
  step: number;
}

export interface NumericValueMetadata {
  value: ValueFieldMetadata;
}

export interface Vec2FieldMetadata {
  x: ValueFieldMetadata;
  y: ValueFieldMetadata;
}

export interface Vec3FieldMetadata {
  x: ValueFieldMetadata;
  y: ValueFieldMetadata;
  z: ValueFieldMetadata;
}

/**
 * Metadata for texture input fields
 */
export interface Sampler2DMetadata {
  /** The texture handle for this field */
  handle: ShaderSampler2DUniform;
}

export interface UniformFieldValue {
  type: ValueType;
  label: string;
  description?: string;
  constraint?:
    | NumericValueMetadata
    | Vec2FieldMetadata
    | Vec3FieldMetadata
    | Sampler2DMetadata;
}
