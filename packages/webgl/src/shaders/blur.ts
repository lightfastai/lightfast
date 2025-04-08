import { z } from "zod";

import type { UniformFieldValue } from "../types/field";
import { createSampler2DHandle } from "../types/shader-sampler2d-uniform";
import { $Float, $Sampler2D, ValueType } from "../types/uniforms";

// Define the schema for our blur shader
export const $Blur = z.object({
  u_texture1: $Sampler2D,
  u_blurRadius: $Float,
  u_blurDirection: $Float,
});

// Create a type based on our schema
export type BlurParams = z.infer<typeof $Blur>;

// Create a texture handle for the input texture
export const blurInputHandle = createSampler2DHandle(
  "blur-input",
  "u_texture1",
);

// Define uniform constraints
export const BLUR_UNIFORM_CONSTRAINTS: Record<
  keyof BlurParams,
  UniformFieldValue
> = {
  u_texture1: {
    type: ValueType.Sampler2D,
    label: "Input",
    description: "Input texture to blur",
  },
  u_blurRadius: {
    type: ValueType.Numeric,
    label: "Radius",
    description: "Blur radius in pixels",
    constraint: {
      value: {
        min: 0,
        max: 20,
        step: 0.1,
      },
    },
  },
  u_blurDirection: {
    type: ValueType.Numeric,
    label: "Direction",
    description: "Blur direction (0 for horizontal, 1 for vertical)",
    constraint: {
      value: {
        min: 0,
        max: 1,
        step: 1,
      },
    },
  },
};

// Create default values function
export function createDefaultBlur(): BlurParams {
  return {
    u_texture1: {
      ...blurInputHandle,
      vuvID: null,
    },
    u_blurRadius: 5.0,
    u_blurDirection: 0.0,
  };
}

// Fragment shader implementation
export const blurFragmentShader = `
precision highp float;

uniform sampler2D u_texture1;
uniform float u_blurRadius;
uniform float u_blurDirection;
varying vec2 vUv;

void main() {
  vec4 sum = vec4(0.0);
  vec2 resolution = vec2(512.0); // Could be passed as a uniform
  vec2 texelSize = 1.0 / resolution;
  
  // Determine blur direction
  vec2 direction = u_blurDirection < 0.5 
    ? vec2(1.0, 0.0)   // Horizontal
    : vec2(0.0, 1.0);  // Vertical
  
  // Apply Gaussian blur
  float blurRadius = u_blurRadius;
  for (float i = -blurRadius; i <= blurRadius; i++) {
    vec2 offset = i * texelSize * direction;
    sum += texture2D(u_texture1, vUv + offset);
  }
  
  gl_FragColor = sum / (2.0 * blurRadius + 1.0);
}
`;
