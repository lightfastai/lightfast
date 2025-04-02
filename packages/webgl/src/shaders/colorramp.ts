import type { JSONSchema7 } from "json-schema";
import { z } from "zod";
import zodToJsonSchema from "zod-to-json-schema";

import type { UniformFieldValue } from "../types/field";
import { $Float, $Vec3Number, ValueType } from "../types/schema";

export const $ColorRamp = z.object({
  u_texture1: z
    .number()
    .nullable()
    .describe("The input texture to use for the ramp"),
  u_color1: $Vec3Number.extend({
    x: $Float
      .describe("Red component of first color (0-1)")
      .transform((val) => Math.max(0, Math.min(1, val)))
      .default(0.0),
    y: $Float
      .describe("Green component of first color (0-1)")
      .transform((val) => Math.max(0, Math.min(1, val)))
      .default(0.0),
    z: $Float
      .describe("Blue component of first color (0-1)")
      .transform((val) => Math.max(0, Math.min(1, val)))
      .default(0.0),
  }),
  u_color2: $Vec3Number.extend({
    x: $Float
      .describe("Red component of second color (0-1)")
      .transform((val) => Math.max(0, Math.min(1, val)))
      .default(1.0),
    y: $Float
      .describe("Green component of second color (0-1)")
      .transform((val) => Math.max(0, Math.min(1, val)))
      .default(1.0),
    z: $Float
      .describe("Blue component of second color (0-1)")
      .transform((val) => Math.max(0, Math.min(1, val)))
      .default(1.0),
  }),
  u_rampStart: $Float
    .describe("Start value of the ramp (0-1)")
    .transform((val) => Math.max(0, Math.min(1, val)))
    .default(0.0),
  u_rampEnd: $Float
    .describe("End value of the ramp (0-1)")
    .transform((val) => Math.max(0, Math.min(1, val)))
    .default(1.0),
  u_rampGamma: $Float
    .describe("Gamma correction for the ramp (0.1-10)")
    .transform((val) => Math.max(0.1, Math.min(10, val)))
    .default(1.0),
});

export type ColorRampParams = z.infer<typeof $ColorRamp>;

export const ColorRampJsonSchema = zodToJsonSchema($ColorRamp) as JSONSchema7;

export const ColorRampDescription =
  "Creates a gradient between two colors based on input values. Supports expressions prefixed with 'e.' for dynamic values.";

export const createDefaultColorRamp = (): ColorRampParams => {
  return $ColorRamp.parse({
    u_texture1: null,
    u_color1: { x: 0.0, y: 0.0, z: 0.0 },
    u_color2: { x: 1.0, y: 1.0, z: 1.0 },
    u_rampStart: 0.0,
    u_rampEnd: 1.0,
    u_rampGamma: 1.0,
  });
};

// Lookup table for colorramp uniform constraints
export const COLORRAMP_UNIFORM_CONSTRAINTS: Record<string, UniformFieldValue> =
  {
    u_color1: {
      type: ValueType.Vec3,
      label: "Color 1",
      constraint: {
        x: { min: 0, max: 1, step: 0.1 },
        y: { min: 0, max: 1, step: 0.1 },
        z: { min: 0, max: 1, step: 0.1 },
      },
    },
    u_color2: {
      type: ValueType.Vec3,
      label: "Color 2",
      constraint: {
        x: { min: 0, max: 1, step: 0.1 },
        y: { min: 0, max: 1, step: 0.1 },
        z: { min: 0, max: 1, step: 0.1 },
      },
    },
    u_rampStart: {
      type: ValueType.Numeric,
      label: "Ramp Start",
      constraint: {
        value: { min: 0, max: 1, step: 0.1 },
      },
    },
    u_rampEnd: {
      type: ValueType.Numeric,
      label: "Ramp End",
      constraint: {
        value: { min: 0, max: 1, step: 0.1 },
      },
    },
    u_rampGamma: {
      type: ValueType.Numeric,
      label: "Ramp Gamma",
      constraint: {
        value: { min: 0.1, max: 10, step: 0.1 },
      },
    },
  };

export const colorRampFragmentShader = `
precision highp float;

uniform sampler2D u_texture1;
uniform vec3 u_color1;
uniform vec3 u_color2;
uniform float u_rampStart;
uniform float u_rampEnd;
uniform float u_rampGamma;
varying vec2 vUv;

void main() {
  // Sample the input texture
  vec4 color = texture2D(u_texture, vUv);
  
  // Calculate the ramp position (0-1)
  float rampPos = (color.r - u_rampStart) / (u_rampEnd - u_rampStart);
  
  // Apply gamma correction
  rampPos = pow(rampPos, u_rampGamma);
  
  // Clamp the position
  rampPos = clamp(rampPos, 0.0, 1.0);
  
  // Interpolate between colors
  vec3 result = mix(u_color1, u_color2, rampPos);
  
  // Preserve alpha from input
  gl_FragColor = vec4(result, color.a);
}
`;
