import type { JSONSchema7 } from "json-schema";
import { z } from "zod";
import zodToJsonSchema from "zod-to-json-schema";

import { createConstrainedNumericValue } from "../../schema/schema";

export const $Limit = z.object({
  u_texture: z
    .number()
    .nullable()
    .describe("The texture to apply the limit to."),
  u_quantizationSteps: createConstrainedNumericValue({
    min: 1,
    max: 256,
    default: 1.01,
    description: "The number of steps for the quantization.",
  }),
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
