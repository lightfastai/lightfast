import { z } from "zod";

import type { Sampler2DMetadata, UniformFieldValue } from "../types/field";
import { createSampler2DHandle } from "../types/shader-sampler2d-uniform";
import { $Float, $Sampler2D, ValueType } from "../types/uniforms";

export const limitInputHandle = createSampler2DHandle("input-1", "u_texture1");

export const $Limit = z.object({
  u_texture1: $Sampler2D,
  u_quantizationSteps: $Float,
});

export type LimitParams = z.infer<typeof $Limit>;

export const createDefaultLimit = (): LimitParams => {
  return {
    u_texture1: { vuvID: null },
    u_quantizationSteps: 1.01,
  };
};

// Lookup table for limit uniform constraints
export const LIMIT_UNIFORM_CONSTRAINTS: Record<string, UniformFieldValue> = {
  u_texture1: {
    type: ValueType.Sampler2D,
    label: "Input Texture",
    description: "The input texture to be limited",
    constraint: {
      handle: limitInputHandle,
    } as Sampler2DMetadata,
  },
  u_quantizationSteps: {
    type: ValueType.Numeric,
    label: "Quantization Steps",
    constraint: {
      value: { min: 1, max: 10, step: 0.1 },
    },
  },
};

export const limitFragmentShader = `
precision highp float;

uniform sampler2D u_texture1;
uniform float u_quantizationSteps;
varying vec2 vUv;

void main() {
  vec4 color = texture2D(u_texture1, vUv);
  color.rgb = floor(color.rgb * u_quantizationSteps) / u_quantizationSteps;
  gl_FragColor = color;
}
`;
