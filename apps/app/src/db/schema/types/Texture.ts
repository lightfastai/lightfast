import { z } from "zod";

import {
  $Add,
  $ColorRamp,
  $Displace,
  $Limit,
  $Lookup,
  $PerlinNoise3D,
  ADD_UNIFORM_CONSTRAINTS,
  COLORRAMP_UNIFORM_CONSTRAINTS,
  createDefaultAdd,
  createDefaultColorRamp,
  createDefaultDisplace,
  createDefaultLimit,
  createDefaultLookup,
  createDefaultPerlinNoise3D,
  DISPLACE_UNIFORM_CONSTRAINTS,
  LIMIT_UNIFORM_CONSTRAINTS,
  LOOKUP_UNIFORM_CONSTRAINTS,
  PNOISE_UNIFORM_CONSTRAINTS,
  UniformFieldValue,
} from "@repo/webgl";

export const $TextureTypeValues = [
  "Noise",
  "Limit",
  "Displace",
  "Add",
  "Lookup",
  "ColorRamp",
] as const;

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
  z.object({
    type: z.literal($TextureTypes.enum.Displace),
    uniforms: $Displace,
    resolution: $TextureResolution,
  }),
  z.object({
    type: z.literal($TextureTypes.enum.Add),
    uniforms: $Add,
    resolution: $TextureResolution,
  }),
  z.object({
    type: z.literal($TextureTypes.enum.Lookup),
    uniforms: $Lookup,
    resolution: $TextureResolution,
  }),
  z.object({
    type: z.literal($TextureTypes.enum.ColorRamp),
    uniforms: $ColorRamp,
    resolution: $TextureResolution,
  }),
]);

export const $TextureUniforms = $PerlinNoise3D
  .merge($Limit)
  .merge($Displace)
  .merge($Add)
  .merge($Lookup)
  .merge($ColorRamp);

export type TextureUniforms = z.infer<typeof $TextureUniforms>;
export type Texture = z.infer<typeof $Texture>;
export type NoiseTexture = Extract<Texture, { type: "Noise" }>;
export type LimitTexture = Extract<Texture, { type: "Limit" }>;
export type DisplaceTexture = Extract<Texture, { type: "Displace" }>;
export type AddTexture = Extract<Texture, { type: "Add" }>;
export type LookupTexture = Extract<Texture, { type: "Lookup" }>;
export type ColorRampTexture = Extract<Texture, { type: "ColorRamp" }>;

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
    case $TextureTypes.enum.Lookup:
      return {
        type,
        uniforms: createDefaultLookup(),
        resolution: { width: 256, height: 256 },
      };
    case $TextureTypes.enum.ColorRamp:
      return {
        type,
        uniforms: createDefaultColorRamp(),
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

export const getUniformConstraints = (
  shaderType: TextureType,
): Record<string, UniformFieldValue> => {
  switch (shaderType) {
    case "Noise":
      return PNOISE_UNIFORM_CONSTRAINTS;
    case "Displace":
      return DISPLACE_UNIFORM_CONSTRAINTS;
    case "Limit":
      return LIMIT_UNIFORM_CONSTRAINTS;
    case "Add":
      return ADD_UNIFORM_CONSTRAINTS;
    case "Lookup":
      return LOOKUP_UNIFORM_CONSTRAINTS;
    case "ColorRamp":
      return COLORRAMP_UNIFORM_CONSTRAINTS;
    default:
      return {};
  }
};

// Get number of inputs needed for each texture type
export const getTextureInputs = (textureType: string): number => {
  switch (textureType) {
    case $TextureTypes.enum.Displace:
      return 2;
    case $TextureTypes.enum.Add:
      return 2;
    case $TextureTypes.enum.ColorRamp:
      return 1;
    case $TextureTypes.enum.Lookup:
      return 2;
    default:
      return 1;
  }
};

// Get input labels for each texture type and position
export const getInputLabel = (
  textureType: string,
  inputIndex: number,
): string => {
  if (textureType === $TextureTypes.enum.Displace) {
    return inputIndex === 0 ? "Source Image" : "Displacement Map";
  } else if (textureType === $TextureTypes.enum.Add) {
    return inputIndex === 0 ? "Input A" : "Input B";
  } else if (textureType === $TextureTypes.enum.Lookup) {
    return inputIndex === 0 ? "Input Texture" : "Lookup Texture";
  }
  return `Input ${inputIndex + 1}`;
};
