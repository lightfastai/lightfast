import type { JSONSchema7 } from "json-schema";
import { z } from "zod";
import zodToJsonSchema from "zod-to-json-schema";

import type { TextureFieldMetadata, UniformFieldValue } from "../types/field";
import type { TextureUniform } from "../types/texture-uniform";
import { createTextureHandle } from "../types/handle";
import { $Float, $Vec2Number, ValueType } from "../types/schema";
import { createTextureUniform } from "../types/texture-uniform";

// Create texture handles for the uniforms
const sourceTextureHandle = createTextureHandle("source", "u_texture1");
const displacementMapHandle = createTextureHandle("displacement", "u_texture2");

if (!sourceTextureHandle || !displacementMapHandle) {
  throw new Error("Failed to create texture handles for displace shader");
}

// Define texture uniforms
export const $DisplaceTextureUniforms = z.object({
  u_texture1: z.custom<TextureUniform>(),
  u_texture2: z.custom<TextureUniform>(),
});

export type DisplaceTextureUniforms = z.infer<typeof $DisplaceTextureUniforms>;

// Define regular uniforms
export const $DisplaceRegularUniforms = z.object({
  u_displaceWeight: $Float
    .describe("X weight of displacement (0-10)")
    .transform((val) => Math.max(0, Math.min(10, val)))
    .default(1.0),
  u_displaceMidpoint: $Vec2Number.extend({
    x: $Float
      .describe("X midpoint of displacement (0-1)")
      .transform((val) => Math.max(0, Math.min(1, val)))
      .default(0.5),
    y: $Float
      .describe("Y midpoint of displacement (0-1)")
      .transform((val) => Math.max(0, Math.min(1, val)))
      .default(0.5),
  }),
  u_displaceOffset: $Vec2Number.extend({
    x: $Float
      .describe("X offset of displacement (0-1)")
      .transform((val) => Math.max(0, Math.min(1, val)))
      .default(0.5),
    y: $Float
      .describe("Y offset of displacement (0-1)")
      .transform((val) => Math.max(0, Math.min(1, val)))
      .default(0.5),
  }),
  u_displaceOffsetWeight: $Float
    .describe("X weight of offset (0-10)")
    .transform((val) => Math.max(0, Math.min(10, val)))
    .default(0.0),
  u_displaceUVWeight: $Vec2Number.extend({
    x: $Float
      .describe("X UV weight (0-2)")
      .transform((val) => Math.max(0, Math.min(2, val)))
      .default(1.0),
    y: $Float
      .describe("Y UV weight (0-2)")
      .transform((val) => Math.max(0, Math.min(2, val)))
      .default(1.0),
  }),
});

export type DisplaceRegularUniforms = z.infer<typeof $DisplaceRegularUniforms>;

// Combine them for the full shader definition
export const $Displace = $DisplaceTextureUniforms.merge(
  $DisplaceRegularUniforms,
);

export type DisplaceParams = z.infer<typeof $Displace>;

export const $DisplaceJsonSchema = zodToJsonSchema($Displace) as JSONSchema7;

export const DisplaceDescription =
  "A texture operator that displaces one texture using another as a displacement map. Supports expressions prefixed with 'e.' for dynamic values.";

export const createDefaultDisplace = (): DisplaceParams => {
  return {
    // Texture uniforms with the new format
    u_texture1: createTextureUniform(sourceTextureHandle, null),
    u_texture2: createTextureUniform(displacementMapHandle, null),
    // Regular uniforms remain the same
    u_displaceWeight: 1.0,
    u_displaceMidpoint: { x: 0.5, y: 0.5 },
    u_displaceOffset: { x: 0.5, y: 0.5 },
    u_displaceOffsetWeight: 0.0,
    u_displaceUVWeight: { x: 1.0, y: 1.0 },
  };
};

// Lookup table for displace uniform constraints
export const DISPLACE_UNIFORM_CONSTRAINTS: Record<string, UniformFieldValue> = {
  u_texture1: {
    type: ValueType.Texture,
    label: "Source Texture",
    constraint: {
      handle: sourceTextureHandle,
      required: true,
      description: "The source texture to be displaced",
    } as TextureFieldMetadata,
  },
  u_texture2: {
    type: ValueType.Texture,
    label: "Displacement Map",
    constraint: {
      handle: displacementMapHandle,
      required: true,
      description: "The displacement map texture",
    } as TextureFieldMetadata,
  },
  u_displaceWeight: {
    type: ValueType.Numeric,
    label: "Displacement Weight",
    constraint: {
      value: { min: 0, max: 10, step: 0.1 },
    },
  },
  u_displaceMidpoint: {
    type: ValueType.Vec2,
    label: "Displacement Midpoint",
    constraint: {
      x: { min: 0, max: 1, step: 0.1 },
      y: { min: 0, max: 1, step: 0.1 },
    },
  },
  u_displaceOffset: {
    type: ValueType.Vec2,
    label: "Displacement Offset",
    constraint: {
      x: { min: 0, max: 1, step: 0.1 },
      y: { min: 0, max: 1, step: 0.1 },
    },
  },
  u_displaceOffsetWeight: {
    type: ValueType.Numeric,
    label: "Displacement Offset Weight",
    constraint: {
      value: { min: 0, max: 10, step: 0.1 },
    },
  },
  u_displaceUVWeight: {
    type: ValueType.Vec2,
    label: "Displacement UV Weight",
    constraint: {
      x: { min: 0, max: 2, step: 0.1 },
      y: { min: 0, max: 2, step: 0.1 },
    },
  },
};

export const displaceFragmentShader = `
precision highp float;

uniform sampler2D u_texture1; // Source texture to be displaced
uniform sampler2D u_texture2; // Displacement map
uniform float u_displaceWeight;
uniform vec2 u_displaceMidpoint;
uniform vec2 u_displaceOffset;
uniform float u_displaceOffsetWeight;
uniform vec2 u_displaceUVWeight;
varying vec2 vUv;

// Displace function using hold extension
vec2 displace(vec2 uv, vec4 displaceMap, float weight, vec2 midpoint, vec2 offset, float offsetWeight, vec2 uvWeight) {
  // Extract R and G channels for X and Y displacement
  float displaceX = displaceMap.r;
  float displaceY = displaceMap.g;
  
  // Apply displacement with weight
  vec2 displaced = uv * uvWeight;
  displaced.x += (displaceX - midpoint.x) * weight + offset.x * offsetWeight;
  displaced.y += (displaceY - midpoint.y) * weight + offset.y * offsetWeight;
  
  // Hold extension mode (clamp to edge)
  displaced = clamp(displaced, 0.0, 1.0);
  
  return displaced;
}

void main() {
  // Get displacement map
  vec4 displaceMap = texture2D(u_texture2, vUv);
  
  // Apply displacement
  vec2 displacedUV = displace(
    vUv,
    displaceMap,
    u_displaceWeight,
    u_displaceMidpoint,
    u_displaceOffset,
    u_displaceOffsetWeight,
    u_displaceUVWeight
  );
  
  // Sample the texture with the displaced coordinates
  vec4 color = texture2D(u_texture1, displacedUV);
  
  gl_FragColor = color;
}
`;
