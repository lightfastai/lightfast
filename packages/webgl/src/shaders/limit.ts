import type { JSONSchema7 } from "json-schema";
import { z } from "zod";
import zodToJsonSchema from "zod-to-json-schema";

import type { UniformConstraint } from "../types/uniform-constraints";
import { $Float, ValueType } from "../types/schema";

export const $Limit = z.object({
  u_texture: z.number().nullable().describe("The input texture to be limited"),
  u_quantizationSteps: $Float
    .describe("Number of quantization steps (1-100)")
    .transform((val) => Math.max(1, Math.min(100, val)))
    .default(1.01),
});

export type LimitParams = z.infer<typeof $Limit>;

export const LimitJsonSchema = zodToJsonSchema($Limit) as JSONSchema7;

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
    type: ValueType.Numeric,
    metadata: {
      value: { min: 1, max: 100, step: 0.1 },
    },
  },
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
