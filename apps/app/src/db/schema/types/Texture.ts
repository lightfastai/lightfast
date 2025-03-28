import { z } from "zod";

import { $Limit, createDefaultLimit } from "@repo/webgl/shaders/limit";
import {
  $PerlinNoise3D,
  createDefaultPerlinNoise3D,
} from "@repo/webgl/shaders/pnoise";

export const $TextureTypeValues = ["Noise", "Limit"] as const;

export const $TextureTypes = z.enum($TextureTypeValues);

export type TextureType = z.infer<typeof $TextureTypes>;

export const $TextureResolution = z.object({
  width: z.number().min(1).max(2048).default(256),
  height: z.number().min(1).max(2048).default(256),
});

export type TextureResolution = z.infer<typeof $TextureResolution>;

export const $Texture = z.discriminatedUnion("type", [
  z.object({
    type: z.literal($TextureTypes.enum.Noise),
    uniforms: $PerlinNoise3D,
    resolution: $TextureResolution,
  }),
  z.object({
    type: z.literal($TextureTypes.enum.Limit),
    uniforms: $Limit,
    resolution: $TextureResolution,
  }),
]);

export const $TextureUniforms = $PerlinNoise3D.merge($Limit);

export type TextureUniforms = z.infer<typeof $TextureUniforms>;
export type Texture = z.infer<typeof $Texture>;
export type NoiseTexture = Extract<Texture, { type: "Noise" }>;
export type LimitTexture = Extract<Texture, { type: "Limit" }>;

export const createDefaultTexture = ({
  type,
}: {
  type: TextureType;
}): Texture => {
  switch (type) {
    case $TextureTypes.enum.Noise:
      return {
        type,
        uniforms: createDefaultPerlinNoise3D(),
        resolution: { width: 256, height: 256 },
      };
    case $TextureTypes.enum.Limit:
      return {
        type,
        uniforms: createDefaultLimit(),
        resolution: { width: 256, height: 256 },
      };
    /**
     * @important This should never happen.
     * @todo: Add better error handling.
     */
    default:
      throw new Error(`Unknown texture type: ${type}`);
  }
};
