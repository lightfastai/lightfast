import { z } from "zod";

import type { Sampler2DMetadata, UniformFieldValue } from "../field";
import { createSampler2DHandle } from "../../uniforms/handle";
import { baseVertexShader } from "../base-vert-shader";
import { $ValueType } from "../enums/values";
import { createBaseShaderDefinition } from "../interfaces/shader-def";
import { $Boolean, $Float, $Sampler2D } from "../uniforms";

// Define the shader name for code generation
const SHADER_NAME = "Add";

// Create texture handles for the uniforms
export const addInput1Handle = createSampler2DHandle("input-1", "u_texture1");
export const addInput2Handle = createSampler2DHandle("input-2", "u_texture2");

// Combine them for the full shader definition
export const $Add = z.object({
  u_texture1: $Sampler2D,
  u_texture2: $Sampler2D,
  u_addValue: $Float,
  u_enableMirror: $Boolean,
});

export type AddParams = z.infer<typeof $Add>;

export const createDefaultAdd = (): AddParams => {
  return {
    // Texture uniforms with the new format
    u_texture1: { vuvID: null },
    u_texture2: { vuvID: null },
    // Regular uniforms remain the same
    u_addValue: 0.0,
    u_enableMirror: false,
  };
};

// Lookup table for add uniform constraints
export const ADD_UNIFORM_CONSTRAINTS: Record<string, UniformFieldValue> = {
  u_texture1: {
    type: $ValueType.enum.Sampler2D,
    description: "The first input texture (A)",
    label: "Input A",
    constraint: {
      handle: addInput1Handle,
    } as Sampler2DMetadata,
  },
  u_texture2: {
    type: $ValueType.enum.Sampler2D,
    description: "The second input texture (B)",
    label: "Input B",
    constraint: {
      handle: addInput2Handle,
    } as Sampler2DMetadata,
  },
  u_addValue: {
    type: $ValueType.enum.Numeric,
    label: "Add Value",
    constraint: {
      value: { min: -1, max: 1, step: 0.1 },
    },
  },
  u_enableMirror: {
    type: $ValueType.enum.Boolean,
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

// Create the shader definition - will be picked up by code generation
export const addShaderDefinition = createBaseShaderDefinition({
  type: SHADER_NAME,
  vertexShader: baseVertexShader,
  fragmentShader: addFragmentShader,
  schema: $Add,
  constraints: ADD_UNIFORM_CONSTRAINTS,
  createDefaultValues: createDefaultAdd,
});
