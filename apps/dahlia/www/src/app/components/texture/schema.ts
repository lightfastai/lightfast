import { z } from "zod";

import { $Limit, $PerlinNoise3D } from "@repo/webgl";

import { $Node } from "../schema";

export const $TextureTypeValues = ["Noise", "Limit"] as const;

// Texture Types
export const $TextureTypes = z.enum($TextureTypeValues);

// Base schema that all textures share
const $TextureShared = $Node.extend({
  input: z.number().nullable().default(null), // single input reference
  outputs: z.array(z.number()).default([]), // default output
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

export const $TextureUniforms = $PerlinNoise3D.merge($Limit);
