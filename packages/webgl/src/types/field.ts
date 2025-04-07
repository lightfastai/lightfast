/**
 * Defines constraints and validation rules for shader uniform values.
 * These types are used to specify the valid ranges and step sizes for uniform parameters.
 */

import type { ValueType } from "./schema";
import type { ShaderSampler2DUniform } from "./shader-sampler2d-uniform";

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
export interface HandleMetadata {
  /** The texture handle for this field */
  handle: ShaderSampler2DUniform;
  /** Whether this texture input is required */
  required: boolean;
  /** Description of what this texture input is used for */
  description: string;
}

export interface UniformFieldValue {
  type: ValueType;
  label: string;
  constraint?:
    | NumericValueMetadata
    | Vec2FieldMetadata
    | Vec3FieldMetadata
    | HandleMetadata;
}
