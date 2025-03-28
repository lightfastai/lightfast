import type { JSONSchema7 } from "json-schema";
import { z } from "zod";

import { $Add, $AddJsonSchema, AddDescription } from "./shaders/add/add";
import {
  $Displace,
  $DisplaceJsonSchema,
  DisplaceDescription,
} from "./shaders/displace/displace";
import { $Limit } from "./shaders/limit/limit";
import {
  $PerlinNoise3D,
  PerlinNoise3DDescription,
  u_harmonics,
} from "./shaders/pnoise/pnoise";

/**
 * base modules
 */
export { $Vec3, createConstrainedVec3, isVec3, type Vec3 } from "./schema/vec3";
export { $Vec2, createConstrainedVec2, isVec2, type Vec2 } from "./schema/vec2";
export { $Color, isColor, type Color } from "./schema/color";
export { type Value, isString, isNumber } from "./schema/value";

/**
 * noise modules
 */
export type { PerlinNoise3DParams } from "./shaders/pnoise/pnoise";
export { $PerlinNoise3D } from "./shaders/pnoise/pnoise";
export {
  u_harmonics as $PerlinNoise3DJsonSchema,
  createDefaultPerlinNoise3D,
  PerlinNoise3DDescription,
} from "./shaders/pnoise/pnoise";

/**
 * limit modules
 */
export type { LimitParams } from "./shaders/limit/limit";
export {
  $Limit,
  $LimitJsonSchema,
  createDefaultLimit,
  LimitDescription,
} from "./shaders/limit/limit";

/**
 * displace modules
 */
export type { DisplaceParams } from "./shaders/displace/displace";
export {
  $Displace,
  $DisplaceJsonSchema,
  createDefaultDisplace,
  DisplaceDescription,
} from "./shaders/displace/displace";

/**
 * add modules
 */
export type { AddParams } from "./shaders/add/add";
export {
  $Add,
  $AddJsonSchema,
  createDefaultAdd,
  AddDescription,
} from "./shaders/add/add";

/**
 * Shared texture uniforms type
 */
export const $TextureUniforms = $PerlinNoise3D
  .merge($Limit)
  .merge($Displace)
  .merge($Add);
export type TextureUniforms = z.infer<typeof $TextureUniforms>;

/**
 * Texture type
 */
export const $TextureType = z.enum(["Noise", "Limit", "Displace", "Add"]);
export type TextureType = z.infer<typeof $TextureType>;

/** Build JSON Schema for Texture System */
export const $TextureSystemJsonSchema = {
  title: "Texture Operator Primitives",
  description:
    "A collection of texture operators that can be used to create textures for 3D objects using ThreeJS. A pipelined approach using WebGL render targets are created where each texture operator is a render target and can be used as an input to the next texture operator. The textures are created using GLSL shaders.",
  textures: [
    {
      title: $TextureType.Values.Noise,
      description: PerlinNoise3DDescription,
      properties: {
        uniforms: u_harmonics,
        // vertexShader: perlinNoise3DVertexShader,
        // fragmentShader: perlinNoise3DFragmentShader,
      },
    },
    {
      title: $TextureType.Values.Displace,
      description: DisplaceDescription,
      properties: {
        uniforms: $DisplaceJsonSchema,
      },
    },
    {
      title: $TextureType.Values.Add,
      description: AddDescription,
      properties: {
        uniforms: $AddJsonSchema,
      },
    },
    // {
    //   title: $TextureType.Values.Limit,
    //   description: LimitDescription,
    //   properties: {
    //     uniforms: $LimitJsonSchema,
    //     vertexShader: limitVertexShader,
    //     fragmentShader: limitFragmentShader,
    //   },
    // },
  ],
} as JSONSchema7;
