import type { UniformConstraint, Vec1FieldMetadata } from "../shared/metadata";

// Lookup table for limit uniform constraints
export const LIMIT_UNIFORM_CONSTRAINTS: Record<string, UniformConstraint> = {
  u_quantizationSteps: {
    type: "vec1",
    metadata: {
      x: { min: 1, max: 256, step: 0.01 },
    },
  },
};

/**
 * Gets metadata for a Vec1 field from the lookup table.
 * @param name - The name of the uniform.
 * @returns An object with metadata for x component.
 */
export const getLimitValueFieldMetadata = (name: string): Vec1FieldMetadata => {
  const constraint = LIMIT_UNIFORM_CONSTRAINTS[name];
  if (!constraint || constraint.type !== "vec1") {
    // Default fallback
    return {
      x: { min: 0, max: 1, step: 0.1 },
    };
  }
  return constraint.metadata as Vec1FieldMetadata;
};
