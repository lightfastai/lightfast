import type { JSONSchema7 } from "json-schema";
import { z } from "zod";
import zodToJsonSchema from "zod-to-json-schema";

import type { HandleMetadata, UniformFieldValue } from "../types/field";
import type { ShaderUniform } from "../types/shader-uniform";
import { $Float, ValueType } from "../types/schema";
import { createShaderInputTextureHandle } from "../types/shader-input-texture-handle";
import { createShaderUniform } from "../types/shader-uniform";

// Create texture handle for the uniform
export const limitInputHandle = createShaderInputTextureHandle(
  "input-1",
  "u_texture1",
);

// Define texture uniforms
export const $LimitTextureUniforms = z.object({
  u_texture1: z.custom<ShaderUniform>(),
});

export type LimitTextureUniforms = z.infer<typeof $LimitTextureUniforms>;

// Define regular uniforms
export const $LimitRegularUniforms = z.object({
  u_quantizationSteps: $Float
    .describe("Number of quantization steps (1-100)")
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
    u_texture1: createShaderUniform(limitInputHandle, null),
    // Regular uniforms remain the same
    u_quantizationSteps: 1.01,
  };
};

// Lookup table for limit uniform constraints
export const LIMIT_UNIFORM_CONSTRAINTS: Record<string, UniformFieldValue> = {
  u_texture1: {
    type: ValueType.Texture,
    label: "Input Texture",
    constraint: {
      handle: limitInputHandle,
      required: true,
      description: "The input texture to be limited",
    } as HandleMetadata,
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

uniform sampler2D u_texture1;
uniform float u_quantizationSteps;
varying vec2 vUv;

void main() {
  vec4 color = texture2D(u_texture1, vUv);
  color.rgb = floor(color.rgb * u_quantizationSteps) / u_quantizationSteps;
  gl_FragColor = color;
}
`;
