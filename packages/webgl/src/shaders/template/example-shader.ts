import { z } from "zod";

import type { Sampler2DMetadata, UniformFieldValue } from "../field";
import { createSampler2DHandle } from "../../uniforms/handle";
import { baseVertexShader } from "../base-vert-shader";
import { $ValueType } from "../enums/values";
import { createBaseShaderDefinition } from "../interfaces/shader-def";
import { $Boolean, $Float, $Sampler2D } from "../uniforms";

/**
 * Define the shader name constant
 * This will be extracted by the code generation script
 */
const SHADER_NAME = "Example";

// Create texture handles for the uniforms (if needed)
export const exampleInputHandle = createSampler2DHandle("input", "u_texture");

// Define the schema for the shader uniforms
export const $Example = z.object({
  u_texture: $Sampler2D,
  u_intensity: $Float,
  u_useEffect: $Boolean,
});

// Create a type for the params
export type ExampleParams = z.infer<typeof $Example>;

// Define a function to create default values
export const createDefaultExample = (): ExampleParams => {
  return {
    u_texture: { vuvID: null },
    u_intensity: 0.5,
    u_useEffect: true,
  };
};

// Define uniform constraints
export const EXAMPLE_UNIFORM_CONSTRAINTS: Record<string, UniformFieldValue> = {
  u_texture: {
    type: $ValueType.enum.Sampler2D,
    description: "Input texture",
    label: "Input",
    constraint: {
      handle: exampleInputHandle,
    } as Sampler2DMetadata,
  },
  u_intensity: {
    type: $ValueType.enum.Numeric,
    label: "Effect Intensity",
    constraint: {
      value: { min: 0, max: 1, step: 0.01 },
    },
  },
  u_useEffect: {
    type: $ValueType.enum.Boolean,
    label: "Use Effect",
  },
};

// Define the fragment shader
export const exampleFragmentShader = `
precision highp float;

uniform sampler2D u_texture;
uniform float u_intensity;
uniform bool u_useEffect;
varying vec2 vUv;

void main() {
  // Sample the input texture
  vec4 color = texture2D(u_texture, vUv);
  
  // Apply effect if enabled
  if (u_useEffect) {
    // Example effect: grayscale with controlled intensity
    float gray = dot(color.rgb, vec3(0.299, 0.587, 0.114));
    color.rgb = mix(color.rgb, vec3(gray), u_intensity);
  }
  
  gl_FragColor = color;
}
`;

/**
 * Create the shader definition
 * This export will be picked up by the code generation script
 */
export const exampleShaderDefinition = createBaseShaderDefinition({
  type: SHADER_NAME, // Will be replaced by enum value during code generation
  vertexShader: baseVertexShader,
  fragmentShader: exampleFragmentShader,
  schema: $Example,
  constraints: EXAMPLE_UNIFORM_CONSTRAINTS,
  createDefaultValues: createDefaultExample,
});
