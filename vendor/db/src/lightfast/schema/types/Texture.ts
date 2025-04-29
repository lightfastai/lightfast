import { z } from "zod";

import {
  $Add,
  $Displace,
  $Limit,
  $Migrated,
  $PerlinNoise2D,
  $Shaders,
} from "@repo/webgl";

export const $TextureType = z.enum($Shaders.options);

export type TextureType = z.infer<typeof $TextureType>;

export const $TextureResolution = z.object({
  width: z.number().min(1).max(2048).default(256),
  height: z.number().min(1).max(2048).default(256),
});

export type TextureResolution = z.infer<typeof $TextureResolution>;

export const $Texture = z.discriminatedUnion("type", [
  z.object({
    type: z.literal($Shaders.Enum.Noise),
    uniforms: $PerlinNoise2D,
    resolution: $TextureResolution,
  }),
  z.object({
    type: z.literal($Shaders.enum.Limit),
    uniforms: $Limit,
    resolution: $TextureResolution,
  }),
  z.object({
    type: z.literal($Shaders.enum.Displace),
    uniforms: $Displace,
    resolution: $TextureResolution,
  }),
  z.object({
    type: z.literal($Shaders.enum.Add),
    uniforms: $Add,
    resolution: $TextureResolution,
  }),
  z.object({
    type: z.literal($Shaders.enum.Migrated),
    uniforms: $Migrated,
    resolution: $TextureResolution,
  }),
]);

export const $TextureUniforms = $PerlinNoise2D
  .merge($Limit)
  .merge($Displace)
  .merge($Add)
  .merge($Migrated);

export type TextureUniforms = z.infer<typeof $TextureUniforms>;
export type Texture = z.infer<typeof $Texture>;

export const createDefaultTexture = ({
  type,
}: {
  type: TextureType;
}): Texture => {
  switch (type) {
    case $TextureType.enum.Noise:
      return {
        type,
        uniforms: $PerlinNoise2D.parse({}),
        resolution: { width: 256, height: 256 },
      };
    case $TextureType.enum.Limit:
      return {
        type,
        uniforms: $Limit.parse({}),
        resolution: { width: 256, height: 256 },
      };
    case $TextureType.enum.Displace:
      return {
        type,
        uniforms: $Displace.parse({}),
        resolution: { width: 256, height: 256 },
      };
    case $TextureType.enum.Add:
      return {
        type,
        uniforms: $Add.parse({}),
        resolution: { width: 256, height: 256 },
      };
    case $TextureType.enum.Migrated:
      return {
        type,
        uniforms: $Migrated.parse({}),
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
