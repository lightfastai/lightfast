import type {
  UniformConstraint,
  Vec1FieldMetadata,
  Vec2FieldMetadata,
} from "../shared/metadata";

// Lookup table for displace uniform constraints
export const DISPLACE_UNIFORM_CONSTRAINTS: Record<string, UniformConstraint> = {
  u_displaceWeight: {
    type: "vec1",
    metadata: {
      x: { min: 0, max: 10, step: 0.1 },
    },
  },
  u_displaceMidpoint: {
    type: "vec2",
    metadata: {
      x: { min: 0, max: 1, step: 0.1 },
      y: { min: 0, max: 1, step: 0.1 },
    },
  },
  u_displaceOffset: {
    type: "vec2",
    metadata: {
      x: { min: 0, max: 1, step: 0.1 },
      y: { min: 0, max: 1, step: 0.1 },
    },
  },
  u_displaceOffsetWeight: {
    type: "vec1",
    metadata: {
      x: { min: 0, max: 10, step: 0.1 },
    },
  },
  u_displaceUVWeight: {
    type: "vec2",
    metadata: {
      x: { min: 0, max: 2, step: 0.1 },
      y: { min: 0, max: 2, step: 0.1 },
    },
  },
};

/**
 * Gets metadata for a Vec1 field from the lookup table.
 * @param name - The name of the uniform.
 * @returns An object with metadata for x component.
 */
export const getDisplaceValueFieldMetadata = (
  name: string,
): Vec1FieldMetadata => {
  const constraint = DISPLACE_UNIFORM_CONSTRAINTS[name];
  if (!constraint || constraint.type !== "vec1") {
    // Default fallback
    return {
      x: { min: 0, max: 1, step: 0.1 },
    };
  }
  return constraint.metadata as Vec1FieldMetadata;
};

/**
 * Gets metadata for a Vec2 field from the lookup table.
 * @param name - The name of the uniform.
 * @returns An object with metadata for x and y components.
 */
export const getDisplaceVec2FieldMetadata = (
  name: string,
): Vec2FieldMetadata => {
  const constraint = DISPLACE_UNIFORM_CONSTRAINTS[name];
  if (!constraint || constraint.type !== "vec2") {
    // Default fallback
    return {
      x: { min: 0, max: 1, step: 0.1 },
      y: { min: 0, max: 1, step: 0.1 },
    };
  }
  return constraint.metadata as Vec2FieldMetadata;
};
