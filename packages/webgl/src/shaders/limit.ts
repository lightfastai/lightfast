import type { JSONSchema7 } from "json-schema";
import { z } from "zod";
import zodToJsonSchema from "zod-to-json-schema";

import type {
  NumericValueMetadata,
  UniformConstraint,
} from "../types/uniform-constraints";
import { $Float } from "../types/schema";

export const $Limit = z.object({
  u_texture: z
    .number()
    .nullable()
    .describe("The texture to apply the limit to."),
  u_quantizationSteps: $Float
    .describe("The number of steps for the quantization.")
    .transform((val) => Math.max(1, Math.min(256, val)))
    .default(1.01),
});

export type LimitParams = z.infer<typeof $Limit>;

export const $LimitJsonSchema = zodToJsonSchema($Limit) as JSONSchema7;

export const LimitDescription =
  "Applies a limit effect to the input texture by quantizing the values.";

export const createDefaultLimit = (): LimitParams => {
  return $Limit.parse({
    u_texture: null,
    u_quantizationSteps: 1.01,
  });
};

// Lookup table for limit uniform constraints
export const LIMIT_UNIFORM_CONSTRAINTS: Record<string, UniformConstraint> = {
  u_quantizationSteps: {
    type: "numeric",
    metadata: {
      value: { min: 1, max: 256, step: 0.01 },
    },
  },
};

/**
 * Gets metadata for a numeric value field from the lookup table.
 * @param name - The name of the uniform.
 * @returns An object with metadata for the value.
 */
export const getLimitValueFieldMetadata = (
  name: string,
): NumericValueMetadata => {
  const constraint = LIMIT_UNIFORM_CONSTRAINTS[name];
  if (!constraint || constraint.type !== "numeric") {
    // Default fallback
    return {
      value: { min: 0, max: 1, step: 0.1 },
    };
  }
  return constraint.metadata as NumericValueMetadata;
};

export const limitFragmentShader = `
precision highp float;

uniform sampler2D u_texture;
uniform vec2 u_quantizationSteps;
varying vec2 vUv;

void main() {
  vec4 color = texture2D(u_texture, vUv);
  color.rgb = floor(color.rgb * u_quantizationSteps.x) / u_quantizationSteps.x;
  gl_FragColor = color;
}
`;
