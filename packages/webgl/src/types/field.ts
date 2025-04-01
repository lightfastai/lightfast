/**
 * Defines constraints and validation rules for shader uniform values.
 * These types are used to specify the valid ranges and step sizes for uniform parameters.
 */

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

export interface UniformFieldValue {
  type: ValueType;
  label: string;
  constraint?: NumericValueMetadata | Vec2FieldMetadata | Vec3FieldMetadata;
}
