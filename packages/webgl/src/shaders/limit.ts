import type { JSONSchema7 } from "json-schema";
import { z } from "zod";
import zodToJsonSchema from "zod-to-json-schema";

import type { TextureFieldMetadata, UniformFieldValue } from "../types/field";
import { $Float, ValueType } from "../types/schema";
import {
  createTextureUniform,
  createTextureUniformSchema,
} from "../types/texture-uniform";

// Define texture uniforms separately
export const $LimitTextureUniforms = z.object({
  u_texture: createTextureUniformSchema("The input texture to be limited"),
});

export type LimitTextureUniforms = z.infer<typeof $LimitTextureUniforms>;

// Define regular uniforms
export const $LimitRegularUniforms = z.object({
  u_quantizationSteps: $Float
    .describe("Number of quantization steps (1-100)")
    // .transform((val) => Math.max(1, Math.min(100, val)))
    .default(1.01),
});

export type LimitRegularUniforms = z.infer<typeof $LimitRegularUniforms>;

// Combine them for the full shader definition
export const $Limit = $LimitTextureUniforms.merge($LimitRegularUniforms);

export type LimitParams = z.infer<typeof $Limit>;

export const LimitJsonSchema = zodToJsonSchema($Limit) as JSONSchema7;

export const LimitDescription =
  "Applies a limit effect to the input texture by quantizing the values.";

export const createDefaultLimit = (): LimitParams => {
  return {
    // Texture uniforms with the new format
    u_texture: createTextureUniform(null, null),
    // Regular uniforms remain the same
    u_quantizationSteps: 1.01,
  };
};

// Lookup table for limit uniform constraints
export const LIMIT_UNIFORM_CONSTRAINTS: Record<string, UniformFieldValue> = {
  u_texture: {
    type: ValueType.Texture,
    label: "Input Texture",
    constraint: {
      required: true,
      description: "The input texture to be limited",
      uniformName: "u_texture",
    } as TextureFieldMetadata,
  },
  u_quantizationSteps: {
    type: ValueType.Numeric,
    label: "Quantization Steps",
    constraint: {
      value: { min: 1, max: 10, step: 0.1 },
    },
  },
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
