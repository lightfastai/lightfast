import { z } from "zod";

import type {
  NumericValueMetadata,
  Sampler2DMetadata,
  UniformFieldValue,
  Vec2FieldMetadata,
} from "../field";
import { createSampler2DHandle } from "../../uniforms/handle";
import { baseVertexShader } from "../base-vert-shader";
import { $ValueType } from "../enums/values";
import { createBaseShaderDefinition } from "../interfaces/shader-def";
import { $Float, $Sampler2D, $Vec2Number } from "../uniforms";

export const SHADER_NAME = "Displace";

// Create texture handles for the uniforms
export const displaceSourceHandle = createSampler2DHandle(
  "input-1",
  "u_texture1",
);
export const displaceMapHandle = createSampler2DHandle("input-2", "u_texture2");

// Combine them for the full shader definition
export const $Displace = z.object({
  u_texture1: $Sampler2D,
  u_texture2: $Sampler2D,
  u_displaceWeight: $Float,
  u_displaceMidpoint: $Vec2Number,
  u_displaceOffset: $Vec2Number,
  u_displaceOffsetWeight: $Float,
  u_displaceUVWeight: $Vec2Number,
});

export type DisplaceParams = z.infer<typeof $Displace>;

export const createDefaultDisplace = (): DisplaceParams => {
  return {
    u_texture1: { vuvID: null },
    u_texture2: { vuvID: null },
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
    type: $ValueType.enum.Sampler2D,
    label: "Source Texture",
    description: "The source texture to be displaced",
    constraint: {
      handle: displaceSourceHandle,
    } as Sampler2DMetadata,
  },
  u_texture2: {
    type: $ValueType.enum.Sampler2D,
    label: "Displacement Map",
    description: "The displacement map texture",
    constraint: {
      handle: displaceMapHandle,
    } as Sampler2DMetadata,
  },
  u_displaceWeight: {
    type: $ValueType.enum.Numeric,
    label: "Displacement Weight",
    constraint: {
      value: { min: 0, max: 10, step: 0.1 },
    } as NumericValueMetadata,
  },
  u_displaceMidpoint: {
    type: $ValueType.enum.Vec2,
    label: "Displacement Midpoint",
    constraint: {
      x: { min: 0, max: 1, step: 0.1 },
      y: { min: 0, max: 1, step: 0.1 },
    } as Vec2FieldMetadata,
  },
  u_displaceOffset: {
    type: $ValueType.enum.Vec2,
    label: "Displacement Offset",
    constraint: {
      x: { min: 0, max: 1, step: 0.1 },
      y: { min: 0, max: 1, step: 0.1 },
    } as Vec2FieldMetadata,
  },
  u_displaceOffsetWeight: {
    type: $ValueType.enum.Numeric,
    label: "Displacement Offset Weight",
    constraint: {
      value: { min: 0, max: 10, step: 0.1 },
    } as NumericValueMetadata,
  },
  u_displaceUVWeight: {
    type: $ValueType.enum.Vec2,
    label: "Displacement UV Weight",
    constraint: {
      x: { min: 0, max: 2, step: 0.1 },
      y: { min: 0, max: 2, step: 0.1 },
    } as Vec2FieldMetadata,
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

export const displaceShaderDefinition = createBaseShaderDefinition({
  type: SHADER_NAME,
  vertexShader: baseVertexShader,
  fragmentShader: displaceFragmentShader,
  schema: $Displace,
  constraints: DISPLACE_UNIFORM_CONSTRAINTS,
  createDefaultValues: createDefaultDisplace,
});
