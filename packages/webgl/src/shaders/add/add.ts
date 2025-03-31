import type { JSONSchema7 } from "json-schema";
import { z } from "zod";
import zodToJsonSchema from "zod-to-json-schema";

import { $Boolean, $NumericValue } from "../../schema/schema";

export const $Add = z.object({
  u_texture1: z.number().nullable().describe("The first input texture (A)"),
  u_texture2: z.number().nullable().describe("The second input texture (B)"),
  u_addValue: $NumericValue
    .default(0.0)
    .describe("Constant value to add to the result"),
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
