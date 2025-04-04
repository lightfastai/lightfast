/**
 * Defines constraints and validation rules for shader uniform values.
 * These types are used to specify the valid ranges and step sizes for uniform parameters.
 */

import type { TextureHandle } from "./handle";
import type { ValueType } from "./schema";

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
export interface TextureFieldMetadata {
  /** The texture handle for this field */
  handle: TextureHandle;
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
    | TextureFieldMetadata;
}
