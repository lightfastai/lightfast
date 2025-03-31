import type { JSONSchema7 } from "json-schema";
import { z } from "zod";
import zodToJsonSchema from "zod-to-json-schema";

import { $NumericValue } from "../../schema/schema";

export const $Limit = z.object({
  u_texture: z
    .number()
    .nullable()
    .describe("The texture to apply the limit to."),
  u_quantizationSteps: $NumericValue
    .default(1.01)
    .describe("The number of steps for the quantization."),
});

export type LimitParams = z.infer<typeof $Limit>;

export const $LimitJsonSchema = zodToJsonSchema($Limit) as JSONSchema7;

export const LimitDescription =
  "A type of texture functionality that limits the color values of a texture to a certain number of steps. Supports expressions prefixed with 'e.' for dynamic values.";

export const createDefaultLimit = (): LimitParams => {
  return $Limit.parse({
    u_texture: null,
    u_quantizationSteps: 1.01,
  });
};

export const limitFragmentShader = `
precision highp float;

uniform sampler2D u_texture;
uniform float u_quantizationSteps;
varying vec2 vUv;

void main() {
  vec4 color = texture2D(u_texture, vUv);
  color.rgb = floor(color.rgb * u_quantizationSteps) / u_quantizationSteps;
  gl_FragColor = color;
}
`;
