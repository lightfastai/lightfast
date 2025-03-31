import type { JSONSchema7 } from "json-schema";
import { z } from "zod";
import zodToJsonSchema from "zod-to-json-schema";

import { $Float, $Vec2Number } from "../../schema/schema";

export const $Displace = z.object({
  u_texture1: z
    .number()
    .nullable()
    .describe("The texture that will be displaced (source image)"),
  u_texture2: z
    .number()
    .nullable()
    .describe("The texture that contains the displacement values (map)"),
  u_displaceWeight: $Float
    .describe("The intensity of the displacement effect")
    .transform((val) => Math.max(0, Math.min(10, val)))
    .default(1.0),
  u_displaceMidpoint: $Vec2Number.extend({
    x: $Float
      .describe("X midpoint (min: 0, max: 1)")
      .transform((val) => Math.max(0, Math.min(1, val)))
      .default(0.5),
    y: $Float
      .describe("Y midpoint (min: 0, max: 1)")
      .transform((val) => Math.max(0, Math.min(1, val)))
      .default(0.5),
  }),
  u_displaceOffset: $Vec2Number.extend({
    x: $Float
      .describe("X offset (min: 0, max: 1)")
      .transform((val) => Math.max(0, Math.min(1, val)))
      .default(0),
    y: $Float
      .describe("Y offset (min: 0, max: 1)")
      .transform((val) => Math.max(0, Math.min(1, val)))
      .default(0),
  }),
  u_displaceOffsetWeight: $Float
    .describe("The intensity of the offset")
    .transform((val) => Math.max(0, Math.min(10, val)))
    .default(0.0),
  u_displaceUVWeight: $Vec2Number.extend({
    x: $Float
      .describe("X UV weight (min: 0, max: 2)")
      .transform((val) => Math.max(0, Math.min(2, val)))
      .default(1),
    y: $Float
      .describe("Y UV weight (min: 0, max: 2)")
      .transform((val) => Math.max(0, Math.min(2, val)))
      .default(1),
  }),
});

export type DisplaceParams = z.infer<typeof $Displace>;

export const $DisplaceJsonSchema = zodToJsonSchema($Displace) as JSONSchema7;

export const DisplaceDescription =
  "A texture operator that displaces one texture using another as a displacement map. Supports expressions prefixed with 'e.' for dynamic values.";

export const createDefaultDisplace = (): DisplaceParams => {
  return $Displace.parse({
    u_texture1: null,
    u_texture2: null,
    u_displaceWeight: { x: 1.0 },
    u_displaceMidpoint: { x: 0.5, y: 0.5 },
    u_displaceOffset: { x: 0.5, y: 0.5 },
    u_displaceOffsetWeight: { x: 0.0 },
    u_displaceUVWeight: { x: 1.0, y: 1.0 },
  });
};

export const displaceFragmentShader = `
precision highp float;

uniform sampler2D u_texture1; // Source texture to be displaced
uniform sampler2D u_texture2; // Displacement map
uniform vec2 u_displaceWeight;
uniform vec2 u_displaceMidpoint;
uniform vec2 u_displaceOffset;
uniform vec2 u_displaceOffsetWeight;
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
    u_displaceWeight.x,
    u_displaceMidpoint,
    u_displaceOffset,
    u_displaceOffsetWeight.x,
    u_displaceUVWeight
  );
  
  // Sample the texture with the displaced coordinates
  vec4 color = texture2D(u_texture1, displacedUV);
  
  gl_FragColor = color;
}
`;
