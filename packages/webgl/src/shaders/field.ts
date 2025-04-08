/**
 * Defines constraints and validation rules for shader uniform values.
 * These types are used to specify the valid ranges and step sizes for uniform parameters.
 */

import type { Sampler2DHandle } from "../uniforms/handle";
import type { ValueType } from "./enums/values";

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
  handle: Sampler2DHandle;
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

/**
 * Gets metadata for a numeric value field from a uniform constraints record.
 * @param name - The name of the uniform.
 * @param constraints - The record of uniform constraints.
 * @returns An object with metadata for the value.
 */
export const getFieldMetadata = (
  name: string,
  constraints: Record<string, UniformFieldValue>,
): UniformFieldValue | null => {
  const constraint = constraints[name];

  if (!constraint) {
    // If the constraint is not found, return null
    // Default fallback
    return null;
  }

  return {
    type: constraint.type,
    label: constraint.label,
    constraint: constraint.constraint,
  };
};
