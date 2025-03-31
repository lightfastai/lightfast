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
export {
  $Vec2,
  $Vec3,
  $Color,
  $ExpressionOrNumber,
  $ExpressionVec2,
  $ExpressionVec3,
  createConstrainedExpressionVec2,
  createConstrainedExpressionVec3,
  isVec2,
  isVec3,
  isColor,
  isExpressionString,
  createExpressionString,
  extractExpression,
  type Vec2,
  type Vec3,
  type Color,
  type Value,
} from "./schema/schema";

/**
 * noise modules
 */
export type { PerlinNoise3DParams } from "./shaders/pnoise/pnoise";
export { $PerlinNoise3D, PerlinNoise3DDescription };

/**
 * limit modules
 */
export type { LimitParams } from "./shaders/limit/limit";
export { $Limit };

/**
 * displace modules
 */
export type { DisplaceParams } from "./shaders/displace/displace";
export { $Displace, DisplaceDescription };

/**
 * add modules
 */
export type { AddParams } from "./shaders/add/add";
export { $Add, AddDescription };

/**
 * Shared texture uniforms type
 */
export const $TextureUniforms = $PerlinNoise3D
  .merge($Limit)
  .merge($Displace)
  .merge($Add);

/**
 * Texture type
 */
export const $TextureType = z.enum(["Noise", "Limit", "Displace", "Add"]);

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
  ],
} as JSONSchema7;
