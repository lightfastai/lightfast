import type {
  UniformConstraint,
  Vec1FieldMetadata,
  Vec2FieldMetadata,
} from "../shared/metadata";

// Lookup table for pnoise uniform constraints
export const PNOISE_UNIFORM_CONSTRAINTS: Record<string, UniformConstraint> = {
  // Noise base uniforms
  u_period: {
    type: "vec1",
    metadata: {
      x: { min: 0.001, max: 100, step: 0.1 },
    },
  },
  u_harmonics: {
    type: "vec1",
    metadata: {
      x: { min: 0, max: 8, step: 1 },
    },
  },
  u_harmonic_gain: {
    type: "vec1",
    metadata: {
      x: { min: 0, max: 1, step: 0.1 },
    },
  },
  u_harmonic_spread: {
    type: "vec1",
    metadata: {
      x: { min: 0, max: 10, step: 0.1 },
    },
  },
  u_amplitude: {
    type: "vec1",
    metadata: {
      x: { min: 0, max: 10, step: 0.1 },
    },
  },
  u_offset: {
    type: "vec1",
    metadata: {
      x: { min: -1, max: 1, step: 0.1 },
    },
  },
  u_exponent: {
    type: "vec1",
    metadata: {
      x: { min: 0.1, max: 10, step: 0.1 },
    },
  },

  // Noise transform uniforms
  u_scale: {
    type: "vec2",
    metadata: {
      x: { min: -1000, max: 1000, step: 0.1 },
      y: { min: -1000, max: 1000, step: 0.1 },
    },
  },
  u_translate: {
    type: "vec2",
    metadata: {
      x: { min: -1000, max: 1000, step: 0.1 },
      y: { min: -1000, max: 1000, step: 0.1 },
    },
  },
  u_rotation: {
    type: "vec2",
    metadata: {
      x: { min: -Math.PI, max: Math.PI, step: 0.1 },
      y: { min: -Math.PI, max: Math.PI, step: 0.1 },
    },
  },
};

/**
 * Gets metadata for a Vec1 field from the lookup table.
 * @param name - The name of the uniform.
 * @returns An object with metadata for x component.
 */
export const getPNoiseValueFieldMetadata = (
  name: string,
): Vec1FieldMetadata => {
  const constraint = PNOISE_UNIFORM_CONSTRAINTS[name];
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
export const getPNoiseVec2FieldMetadata = (name: string): Vec2FieldMetadata => {
  const constraint = PNOISE_UNIFORM_CONSTRAINTS[name];
  if (!constraint || constraint.type !== "vec2") {
    // Default fallback
    return {
      x: { min: 0, max: 1, step: 0.1 },
      y: { min: 0, max: 1, step: 0.1 },
    };
  }
  return constraint.metadata as Vec2FieldMetadata;
};
