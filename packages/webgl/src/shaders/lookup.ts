import type { JSONSchema7 } from "json-schema";
import { z } from "zod";
import zodToJsonSchema from "zod-to-json-schema";

import type { UniformFieldValue } from "../types/field";
import { $Float, ValueType } from "../types/schema";

export const $Lookup = z.object({
  u_texture1: z
    .number()
    .nullable()
    .describe("The input texture to apply the lookup table to"),
  u_texture2: z
    .number()
    .nullable()
    .describe("The lookup table texture (1D or 2D)"),
  u_redWeight: $Float
    .describe("Weight of red channel in lookup (0-1)")
    .transform((val) => Math.max(0, Math.min(1, val)))
    .default(1.0),
  u_greenWeight: $Float
    .describe("Weight of green channel in lookup (0-1)")
    .transform((val) => Math.max(0, Math.min(1, val)))
    .default(1.0),
  u_blueWeight: $Float
    .describe("Weight of blue channel in lookup (0-1)")
    .transform((val) => Math.max(0, Math.min(1, val)))
    .default(1.0),
  u_alphaWeight: $Float
    .describe("Weight of alpha channel in lookup (0-1)")
    .transform((val) => Math.max(0, Math.min(1, val)))
    .default(1.0),
});

export type LookupParams = z.infer<typeof $Lookup>;

export const LookupJsonSchema = zodToJsonSchema($Lookup) as JSONSchema7;

export const LookupDescription =
  "Applies a lookup table transformation to the input texture, allowing for color grading and correction. Supports expressions prefixed with 'e.' for dynamic values.";

export const createDefaultLookup = (): LookupParams => {
  return $Lookup.parse({
    u_texture1: null,
    u_texture2: null,
    u_redWeight: 1.0,
    u_greenWeight: 1.0,
    u_blueWeight: 1.0,
    u_alphaWeight: 1.0,
  });
};

// Lookup table for lookup uniform constraints
export const LOOKUP_UNIFORM_CONSTRAINTS: Record<string, UniformFieldValue> = {
  u_redWeight: {
    type: ValueType.Numeric,
    label: "Red Weight",
    constraint: {
      value: { min: 0, max: 1, step: 0.1 },
    },
  },
  u_greenWeight: {
    type: ValueType.Numeric,
    label: "Green Weight",
    constraint: {
      value: { min: 0, max: 1, step: 0.1 },
    },
  },
  u_blueWeight: {
    type: ValueType.Numeric,
    label: "Blue Weight",
    constraint: {
      value: { min: 0, max: 1, step: 0.1 },
    },
  },
  u_alphaWeight: {
    type: ValueType.Numeric,
    label: "Alpha Weight",
    constraint: {
      value: { min: 0, max: 1, step: 0.1 },
    },
  },
};

export const lookupFragmentShader = `
precision highp float;

uniform sampler2D u_texture1; // Input texture
uniform sampler2D u_texture2; // Lookup texture
uniform float u_redWeight;
uniform float u_greenWeight;
uniform float u_blueWeight;
uniform float u_alphaWeight;
varying vec2 vUv;

void main() {
  // Sample the input texture
  vec4 color = texture2D(u_texture1, vUv);
  
  // Apply lookup table transformation
  vec4 lookupColor;
  lookupColor.r = texture2D(u_texture2, vec2(color.r, 0.5)).r;
  lookupColor.g = texture2D(u_texture2, vec2(color.g, 0.5)).g;
  lookupColor.b = texture2D(u_texture2, vec2(color.b, 0.5)).b;
  lookupColor.a = texture2D(u_texture2, vec2(color.a, 0.5)).a;
  
  // Mix original color with lookup result based on weights
  vec4 result;
  result.r = mix(color.r, lookupColor.r, u_redWeight);
  result.g = mix(color.g, lookupColor.g, u_greenWeight);
  result.b = mix(color.b, lookupColor.b, u_blueWeight);
  result.a = mix(color.a, lookupColor.a, u_alphaWeight);
  
  gl_FragColor = result;
}
`;
