import type { JSONSchema7 } from "json-schema";
import { z } from "zod";
import zodToJsonSchema from "zod-to-json-schema";

import { createConstrainedVec2 } from "../../schema/vec2";
import { $Shared } from "../shared/schema";

export const $Displace = $Shared.merge(
  z.object({
    u_texture: z
      .number()
      .nullable()
      .describe("Legacy field for backward compatibility"),
    u_texture1: z
      .number()
      .nullable()
      .describe("The texture that will be displaced (source image)"),
    u_texture2: z
      .number()
      .nullable()
      .describe("The texture that contains the displacement values (map)"),
    u_displaceWeight: z
      .number()
      .min(0)
      .max(2.0)
      .default(1.0)
      .describe("The intensity of the displacement effect"),
    u_displaceMidpoint: createConstrainedVec2({
      x: { min: 0, max: 1, default: 0.5 },
      y: { min: 0, max: 1, default: 0.5 },
    }).describe("The center reference point for displacement"),
    u_displaceOffset: createConstrainedVec2({
      x: { min: 0, max: 1, default: 0.5 },
      y: { min: 0, max: 1, default: 0.5 },
    }).describe("Additional offset for the displacement"),
    u_displaceOffsetWeight: z
      .number()
      .min(0)
      .max(2.0)
      .default(0.0)
      .describe("The intensity of the offset"),
    u_displaceUVWeight: createConstrainedVec2({
      x: { min: 0, max: 2, default: 1.0 },
      y: { min: 0, max: 2, default: 1.0 },
    }).describe("UV scaling for the displacement"),
  }),
);

export type DisplaceParams = z.infer<typeof $Displace>;

export const $DisplaceJsonSchema = zodToJsonSchema($Displace) as JSONSchema7;

export const DisplaceDescription =
  "A texture operator that displaces one texture using another as a displacement map";

export const createDefaultDisplace = (): DisplaceParams => {
  return $Displace.parse({
    u_texture: null,
    u_texture1: null,
    u_texture2: null,
    u_displaceWeight: 1.0,
    u_displaceMidpoint: { x: 0.5, y: 0.5 },
    u_displaceOffset: { x: 0.5, y: 0.5 },
    u_displaceOffsetWeight: 0.0,
    u_displaceUVWeight: { x: 1.0, y: 1.0 },
  });
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
vec2 displace(vec2 uv, vec2 midpoint, vec2 offset, float offsetWeight, vec2 uvWeight) {
  // Get displacement values from the displacement map
  vec4 displaceMap = texture2D(u_texture2, uv);
  
  // Extract R and G channels for X and Y displacement
  float displaceX = displaceMap.r;
  float displaceY = displaceMap.g;
  
  // Apply displacement with weight
  vec2 displaced = uv * uvWeight;
  displaced.x += (displaceX - midpoint.x) * u_displaceWeight + offset.x * offsetWeight;
  displaced.y += (displaceY - midpoint.y) * u_displaceWeight + offset.y * offsetWeight;
  
  // Hold extension mode (clamp to edge)
  displaced = clamp(displaced, 0.0, 1.0);
  
  return displaced;
}

void main() {
  // Apply displacement
  vec2 displacedUV = displace(vUv, u_displaceMidpoint, u_displaceOffset, u_displaceOffsetWeight, u_displaceUVWeight);
  
  // Sample the texture with the displaced coordinates
  vec4 color = texture2D(u_texture1, displacedUV);
  
  gl_FragColor = color;
}
`;
