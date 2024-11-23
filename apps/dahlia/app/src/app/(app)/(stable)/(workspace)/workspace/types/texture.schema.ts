import { z } from "zod";

import { $Limit } from "@repo/webgl";
import { $PerlinNoise3D } from "@repo/webgl/shaders/pnoise";

export const $TextureTypeValues = ["Noise", "Limit"] as const;

// Texture Types
export const $TextureTypes = z.enum($TextureTypeValues);

// Base schema that all textures share
const $TextureShared = z.object({
  input: z
    .number()
    .nullable()
    .default(null)
    .describe(
      "the id texture to use as an input; commonly reference to as u_texture",
    ),
  outputs: z
    .array(z.number())
    .default([])
    .describe("the ids of textures to use as an output"),
});

const $TextureSharedV2 = z.object({
  input: z
    .number()
    .nullable()
    .default(null)
    .describe(
      "the id texture to use as an input; commonly reference to as u_texture",
    ),
  outputs: z
    .array(z.number())
    .default([])
    .describe("the ids of textures to use as an output"),
});

// Update TextureSchema with base schema
export const $Texture = z.discriminatedUnion("type", [
  $TextureShared.extend({
    type: z.literal("Noise"),
    uniforms: $PerlinNoise3D,
  }),
  $TextureShared.extend({
    type: z.literal("Limit"),
    uniforms: $Limit,
  }),
]);
export const $TextureV2 = $TextureSharedV2.extend({
  type: z.literal("Noise"),
  uniforms: $PerlinNoise3D,
});
