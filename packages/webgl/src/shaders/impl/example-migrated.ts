import { z } from "zod";

import type { Sampler2DMetadata, UniformFieldValue } from "../field";
import { baseVertexShader } from "../base-vert-shader";
import { $ValueType } from "../enums/values";
import { createSampler2DHandle } from "../interfaces/sampler2d-handle";
import { $Boolean, $Float, $Sampler2D } from "../uniforms";

/**
 * Migration Steps:
 * 1. Add the SHADER_NAME constant
 * 2. Keep the existing shader implementation
 * 3. Update the definition export to use the constant
 */

// Step 1: Add this constant for code generation
const SHADER_NAME = "Migrated";

// Existing code below this line
export const migratedInputHandle = createSampler2DHandle("input", "u_texture");

export const $Migrated = z.object({
  u_texture: $Sampler2D,
  u_value: $Float,
  u_toggle: $Boolean,
});

export type MigratedParams = z.infer<typeof $Migrated>;

export const createDefaultMigrated = (): MigratedParams => {
  return {
    u_texture: { vuvID: null },
    u_value: 0.5,
    u_toggle: true,
  };
};

export const MIGRATED_UNIFORM_CONSTRAINTS: Record<string, UniformFieldValue> = {
  u_texture: {
    type: $ValueType.enum.Sampler2D,
    description: "Input texture",
    label: "Input",
    constraint: {
      handle: migratedInputHandle,
    } as Sampler2DMetadata,
  },
  u_value: {
    type: $ValueType.enum.Numeric,
    label: "Value",
    constraint: {
      value: { min: 0, max: 1, step: 0.01 },
    },
  },
  u_toggle: {
    type: $ValueType.enum.Boolean,
    label: "Toggle",
  },
};

export const migratedFragmentShader = `
precision highp float;

uniform sampler2D u_texture;
uniform float u_value;
uniform bool u_toggle;
varying vec2 vUv;

void main() {
  vec4 color = texture2D(u_texture, vUv);
  
  if (u_toggle) {
    color.rgb *= u_value;
  }
  
  gl_FragColor = color;
}
`;

// Step 3: Export definition - will be picked up by code generator
export const migratedShaderDefinition = {
  type: SHADER_NAME, // Will be updated by code generator
  vertexShader: baseVertexShader,
  fragmentShader: migratedFragmentShader,
  schema: $Migrated,
  constraints: MIGRATED_UNIFORM_CONSTRAINTS,
  createDefaultValues: createDefaultMigrated,
};
