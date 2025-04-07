import type { JSONSchema7 } from "json-schema";
import { z } from "zod";
import zodToJsonSchema from "zod-to-json-schema";

import type { Sampler2DMetadata, UniformFieldValue } from "../types/field";
import type { ShaderSampler2DUniform } from "../types/shader-sampler2d-uniform";
import { createSampler2DHandle } from "../types/shader-sampler2d-uniform";
import { $Boolean, $Float, ValueType } from "../types/shader-uniform";

// Create texture handles for the uniforms
export const addInput1Handle = createSampler2DHandle("input-1", "u_texture1");
export const addInput2Handle = createSampler2DHandle("input-2", "u_texture2");

// Define texture uniforms
export const $AddTextureUniforms = z.object({
  u_texture1: z.custom<ShaderSampler2DUniform>(),
  u_texture2: z.custom<ShaderSampler2DUniform>(),
});

export type AddTextureUniforms = z.infer<typeof $AddTextureUniforms>;

// Define regular uniforms
export const $AddRegularUniforms = z.object({
  u_addValue: $Float
    .describe("Constant value to add to the result")
    .transform((val) => Math.max(-1, Math.min(1, val)))
    .default(0.0),
  u_enableMirror: $Boolean
    .default(false)
    .describe("Whether to mirror the result vertically"),
});

export type AddRegularUniforms = z.infer<typeof $AddRegularUniforms>;

// Combine them for the full shader definition
export const $Add = $AddTextureUniforms.merge($AddRegularUniforms);

export type AddParams = z.infer<typeof $Add>;

export const $AddJsonSchema = zodToJsonSchema($Add) as JSONSchema7;

export const AddDescription =
  "A texture operator that adds two textures together with optional mirroring and constant value addition. Supports expressions prefixed with 'e.' for dynamic values.";

export const createDefaultAdd = (): AddParams => {
  return {
    // Texture uniforms with the new format
    u_texture1: addInput1Handle,
    u_texture2: addInput2Handle,
    // Regular uniforms remain the same
    u_addValue: 0.0,
    u_enableMirror: false,
  };
};

// Lookup table for add uniform constraints
export const ADD_UNIFORM_CONSTRAINTS: Record<string, UniformFieldValue> = {
  u_texture1: {
    type: ValueType.Sampler2D,
    label: "Input A",
    constraint: {
      handle: addInput1Handle,
      required: true,
      description: "The first input texture (A)",
    } as Sampler2DMetadata,
  },
  u_texture2: {
    type: ValueType.Sampler2D,
    label: "Input B",
    constraint: {
      handle: addInput2Handle,
      required: true,
      description: "The second input texture (B)",
    } as Sampler2DMetadata,
  },
  u_addValue: {
    type: ValueType.Numeric,
    label: "Add Value",
    constraint: {
      value: { min: -1, max: 1, step: 0.1 },
    },
  },
  u_enableMirror: {
    type: ValueType.Boolean,
    label: "Enable Mirror",
  },
};

export const addFragmentShader = `
precision highp float;

uniform sampler2D u_texture1; // First input texture (A)
uniform sampler2D u_texture2; // Second input texture (B)
uniform float u_addValue;
uniform bool u_enableMirror;
varying vec2 vUv;

void main() {
  // Start with original UVs
  vec2 uv = vUv;
  
  // Apply mirror if enabled
  if (u_enableMirror && uv.y > 0.5) {
    uv.y = 1.0 - uv.y;
  }
  
  // Sample both textures
  vec4 colorA = texture2D(u_texture1, uv);
  vec4 colorB = texture2D(u_texture2, uv);
  
  // Add the textures together
  vec4 result = colorA + colorB;
  
  // Apply add value
  result += vec4(vec3(u_addValue), 0.0);
  
  // Keep alpha intact
  result.a = max(colorA.a, colorB.a);
  
  gl_FragColor = result;
}
`;
