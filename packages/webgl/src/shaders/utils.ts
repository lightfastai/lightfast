import type { UniformFieldValue, Vec2FieldMetadata } from "../types/field";
import { ValueType } from "../types/schema";

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

/**
 * Gets metadata for a Vec2 field from a uniform constraints record.
 * @param name - The name of the uniform.
 * @param constraints - The record of uniform constraints.
 * @returns An object with metadata for x and y components.
 */
export const getVec2FieldMetadata = (
  name: string,
  constraints: Record<string, UniformFieldValue>,
): Vec2FieldMetadata => {
  const constraint = constraints[name];
  if (!constraint || constraint.type !== ValueType.Vec2) {
    // Default fallback
    return {
      x: { min: 0, max: 1, step: 0.1 },
      y: { min: 0, max: 1, step: 0.1 },
    };
  }
  return constraint.constraint as Vec2FieldMetadata;
};
