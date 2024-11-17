import type { JSONSchema7 } from "json-schema";
import { z } from "zod";
import zodToJsonSchema from "zod-to-json-schema";

import { createConstrainedVec2 } from "../../schema/vec2";
import perlinNoise3DFragmentShader from "./pnoise.frag";
import perlinNoise3DVertexShader from "./pnoise.vert";

export const $PerlinNoise3D = z.object({
  // noise
  u_period: z
    .number()
    .min(0.01)
    .max(2)
    .default(1)
    .describe("1/u_period is the frequency of the input of noise function"),
  u_harmonics: z
    .number()
    .int()
    .min(1)
    .max(10)
    .default(2)
    .describe("amount of iterations of noise."), // Number of harmonics; max value is 10
  u_harmonic_gain: z
    .number()
    .min(0)
    .max(2)
    .default(0.7)
    .describe(
      "how much the amplitude changes per iterations (scalar of the amplitude)",
    ),
  u_harmonic_spread: z
    .number()
    .min(0)
    .max(20)
    .default(2)
    .describe(
      "how much the frequency changes per iteration (scalar of the frequency)",
    ),
  u_amplitude: z
    .number()
    .min(0)
    .max(2)
    .default(0.5)
    .describe("The overall amplitude scaling for the noise."), // Overall amplitude scaling; max value adjusted to 2
  u_offset: z
    .number()
    .min(0)
    .max(1)
    .default(0.5)
    .describe("The offset of the noise."),
  u_exponent: z
    .number()
    .min(0)
    .max(4)
    .default(1)
    .describe("The exponent of the noise."),

  // transform
  u_scale: createConstrainedVec2({
    x: { min: -1000, max: 1000, default: 1 },
    y: { min: -1000, max: 1000, default: 1 },
  }).describe("The scale of the noise."),
  u_translate: createConstrainedVec2({
    x: { min: -1000, max: 1000, default: 0 },
    y: { min: -1000, max: 1000, default: 0 },
  }).describe("The offset of the noise."),

  // inputs
  u_texture: z.number().nullable(),
});

export const u_harmonics = zodToJsonSchema($PerlinNoise3D) as JSONSchema7;

export type PerlinNoise3DParams = z.infer<typeof $PerlinNoise3D>;

export const PerlinNoise3DDescription =
  "A type of noise functionality based on perlin noise. Allows you to create a 3D noise texture.";

export const createDefaultPerlinNoise3D = (): PerlinNoise3DParams => {
  return $PerlinNoise3D.parse({
    u_period: 1,
    u_harmonics: 2,
    u_harmonic_gain: 0.7,
    u_harmonic_spread: 2,
    u_amplitude: 0.5,
    u_offset: 0.5,
    u_exponent: 1,
    u_scale: { x: 1, y: 1 },
    u_translate: { x: 0, y: 0 },
    u_texture: null,
  });
};

export { perlinNoise3DVertexShader };
export { perlinNoise3DFragmentShader };
