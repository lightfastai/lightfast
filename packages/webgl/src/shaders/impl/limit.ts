import { z } from "zod";

import type { Sampler2DMetadata, UniformFieldValue } from "../field";
import { baseVertexShader } from "../base-vert-shader";
import { $ValueType } from "../enums/values";
import { createSampler2DHandle } from "../interfaces/sampler2d-handle";
import { createBaseShaderDefinition } from "../interfaces/shader-def";
import { $Float, $Sampler2D } from "../uniforms";

export const SHADER_NAME = "Limit";

export const limitInputHandle = createSampler2DHandle("input-1", "u_texture1");

export const $Limit = z.object({
  u_texture1: $Sampler2D.default({ vuvID: null }),
  u_quantizationSteps: $Float.default(1.01),
});

export type LimitParams = z.infer<typeof $Limit>;

// Lookup table for limit uniform constraints
export const LIMIT_UNIFORM_CONSTRAINTS: Record<string, UniformFieldValue> = {
  u_texture1: {
    type: $ValueType.enum.Sampler2D,
    label: "Input Texture",
    description: "The input texture to be limited",
    constraint: {
      handle: limitInputHandle,
    } as Sampler2DMetadata,
  },
  u_quantizationSteps: {
    type: $ValueType.enum.Numeric,
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

export const limitShaderDefinition = createBaseShaderDefinition({
  type: SHADER_NAME,
  vertexShader: baseVertexShader,
  fragmentShader: limitFragmentShader,
  schema: $Limit,
  constraints: LIMIT_UNIFORM_CONSTRAINTS,
  textureHandles: {
    handles: [limitInputHandle],
    defaultUniformMapping: {
      u_texture1: limitInputHandle,
    },
    validateConnection: () => true, // Limit accepts any texture type
  },
});
