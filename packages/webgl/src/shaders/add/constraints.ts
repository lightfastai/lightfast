import type { UniformConstraint, Vec1FieldMetadata } from "../shared/metadata";

// Lookup table for add uniform constraints
export const ADD_UNIFORM_CONSTRAINTS: Record<string, UniformConstraint> = {
  u_addValue: {
    type: "vec1",
    metadata: {
      x: { min: -1, max: 1, step: 0.1 },
    },
  },
};

/**
 * Gets metadata for a Vec1 field from the lookup table.
 * @param name - The name of the uniform.
 * @returns An object with metadata for x component.
 */
export const getAddValueFieldMetadata = (name: string): Vec1FieldMetadata => {
  const constraint = ADD_UNIFORM_CONSTRAINTS[name];
  if (!constraint || constraint.type !== "vec1") {
    // Default fallback
    return {
      x: { min: 0, max: 1, step: 0.1 },
    };
  }
  return constraint.metadata as Vec1FieldMetadata;
};
