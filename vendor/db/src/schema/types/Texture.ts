import { z } from "zod";

import {
  $Add,
  $Displace,
  $Limit,
  $Migrated,
  $PerlinNoise2D,
  $Shaders,
  createDefaultAdd,
  createDefaultDisplace,
  createDefaultLimit,
  createDefaultMigrated,
  createDefaultPerlinNoise2D,
} from "@repo/webgl";

export const $TextureTypes = z.enum($Shaders.options);

export type TextureTypes = z.infer<typeof $TextureTypes>;

export const $TextureResolution = z.object({
  width: z.number().min(1).max(2048).default(256),
  height: z.number().min(1).max(2048).default(256),
});

export type TextureResolution = z.infer<typeof $TextureResolution>;

export const $Texture = z.discriminatedUnion("type", [
  z.object({
    type: z.literal($Shaders.enum.Noise),
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
  type: TextureTypes;
}): Texture => {
  switch (type) {
    case $TextureTypes.enum.Noise:
      return {
        type,
        uniforms: createDefaultPerlinNoise2D(),
        resolution: { width: 256, height: 256 },
      };
    case $TextureTypes.enum.Limit:
      return {
        type,
        uniforms: createDefaultLimit(),
        resolution: { width: 256, height: 256 },
      };
    case $TextureTypes.enum.Displace:
      return {
        type,
        uniforms: createDefaultDisplace(),
        resolution: { width: 256, height: 256 },
      };
    case $TextureTypes.enum.Add:
      return {
        type,
        uniforms: createDefaultAdd(),
        resolution: { width: 256, height: 256 },
      };
    case $TextureTypes.enum.Migrated:
      return {
        type,
        uniforms: createDefaultMigrated(),
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
