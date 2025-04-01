import type {
  NumericValueMetadata,
  UniformConstraint,
  Vec2FieldMetadata,
} from "../types/uniform-constraints";
import { ValueType } from "../types/schema";

/**
 * Gets metadata for a numeric value field from a uniform constraints record.
 * @param name - The name of the uniform.
 * @param constraints - The record of uniform constraints.
 * @returns An object with metadata for the value.
 */
export const getValueFieldMetadata = (
  name: string,
  constraints: Record<string, UniformConstraint>,
): NumericValueMetadata => {
  const constraint = constraints[name];
  if (!constraint || constraint.type !== ValueType.Numeric) {
    // Default fallback
    return {
      value: { min: 0, max: 1, step: 0.1 },
    };
  }
  return constraint.metadata as NumericValueMetadata;
};

/**
 * Gets metadata for a Vec2 field from a uniform constraints record.
 * @param name - The name of the uniform.
 * @param constraints - The record of uniform constraints.
 * @returns An object with metadata for x and y components.
 */
export const getVec2FieldMetadata = (
  name: string,
  constraints: Record<string, UniformConstraint>,
): Vec2FieldMetadata => {
  const constraint = constraints[name];
  if (!constraint || constraint.type !== ValueType.Vec2) {
    // Default fallback
    return {
      x: { min: 0, max: 1, step: 0.1 },
      y: { min: 0, max: 1, step: 0.1 },
    };
  }
  return constraint.metadata as Vec2FieldMetadata;
};
