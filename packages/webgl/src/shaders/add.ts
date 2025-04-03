import type { JSONSchema7 } from "json-schema";
import { z } from "zod";
import zodToJsonSchema from "zod-to-json-schema";

import type { TextureFieldMetadata, UniformFieldValue } from "../types/field";
import { $Boolean, $Float, ValueType } from "../types/schema";
import {
  createTextureUniform,
  createTextureUniformSchema,
} from "../types/texture-uniform";

// Define texture uniforms separately
export const $AddTextureUniforms = z.object({
  u_texture1: createTextureUniformSchema("The first input texture (A)"),
  u_texture2: createTextureUniformSchema("The second input texture (B)"),
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
    u_texture1: createTextureUniform(null, null),
    u_texture2: createTextureUniform(null, null),
    // Regular uniforms remain the same
    u_addValue: 0.0,
    u_enableMirror: false,
  };
};

// Lookup table for add uniform constraints
export const ADD_UNIFORM_CONSTRAINTS: Record<string, UniformFieldValue> = {
  u_texture1: {
    type: ValueType.Texture,
    label: "Input A",
    constraint: {
      required: true,
      description: "The first input texture (A)",
      uniformName: "u_texture1",
    } as TextureFieldMetadata,
  },
  u_texture2: {
    type: ValueType.Texture,
    label: "Input B",
    constraint: {
      required: true,
      description: "The second input texture (B)",
      uniformName: "u_texture2",
    } as TextureFieldMetadata,
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
