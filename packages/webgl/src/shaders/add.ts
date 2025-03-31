import type { JSONSchema7 } from "json-schema";
import { z } from "zod";
import zodToJsonSchema from "zod-to-json-schema";

import type {
  NumericValueMetadata,
  UniformConstraint,
} from "../types/uniform-constraints";
import { $Boolean, $Float } from "../types/schema";

export const $Add = z.object({
  u_texture1: z.number().nullable().describe("The first input texture (A)"),
  u_texture2: z.number().nullable().describe("The second input texture (B)"),
  u_addValue: $Float
    .describe("Constant value to add to the result")
    .transform((val) => Math.max(-1, Math.min(1, val)))
    .default(0.0),
  u_enableMirror: $Boolean
    .default(false)
    .describe("Whether to mirror the result vertically"),
});

export type AddParams = z.infer<typeof $Add>;

export const $AddJsonSchema = zodToJsonSchema($Add) as JSONSchema7;

export const AddDescription =
  "A texture operator that adds two textures together with optional mirroring and constant value addition. Supports expressions prefixed with 'e.' for dynamic values.";

export const createDefaultAdd = (): AddParams => {
  return $Add.parse({
    u_texture1: null,
    u_texture2: null,
    u_addValue: 0.0,
    u_enableMirror: false,
  });
};

// Lookup table for add uniform constraints
export const ADD_UNIFORM_CONSTRAINTS: Record<string, UniformConstraint> = {
  u_addValue: {
    type: "numeric",
    metadata: {
      value: { min: -1, max: 1, step: 0.1 },
    },
  },
};

/**
 * Gets metadata for a numeric value field from the lookup table.
 * @param name - The name of the uniform.
 * @returns An object with metadata for the value.
 */
export const getAddValueFieldMetadata = (
  name: string,
): NumericValueMetadata => {
  const constraint = ADD_UNIFORM_CONSTRAINTS[name];
  if (!constraint || constraint.type !== "numeric") {
    // Default fallback
    return {
      value: { min: 0, max: 1, step: 0.1 },
    };
  }
  return constraint.metadata as NumericValueMetadata;
};

export const addFragmentShader = `
precision highp float;

uniform sampler2D u_texture1; // First input texture (A)
uniform sampler2D u_texture2; // Second input texture (B)
uniform vec2 u_addValue;
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
  result += vec4(vec3(u_addValue.x), 0.0);
  
  // Keep alpha intact
  result.a = max(colorA.a, colorB.a);
  
  gl_FragColor = result;
}
`;
