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
 * Base types and primitives
 */
export {
  // Primitive types
  $Boolean,
  $Number,
  $Float,
  $Integer,
  $Expression,
  $String,
  type Boolean,
  type Number,
  type Float,
  type Integer,
  type Expression,
  type String,

  // Vector types
  $Vec2,
  $Vec3,
  type Vec2,
  type Vec3,

  // Vector mode specific schemas
  $Vec2Number,
  $Vec2Expression,
  $Vec3Number,
  $Vec3Expression,

  // Color type
  $Color,
  type Color,

  // Value union type
  type Value,
  type NumericValue,
  $NumericValue,

  // Mode enum
  VectorMode,

  // Expression utilities
  EXPRESSION_PREFIX,
  isExpressionString,
  createExpressionString,
  extractExpression,

  // Type guards
  isBoolean,
  isNumber,
  isFloat,
  isInteger,
  isExpression,
  isColor,
  isVec2,
  isString,
  isVec3,
  isNumericValue,

  // Mode detection
  getVec2Mode,
  getVec3Mode,

  // Mode-specific type guards
  isVec2Expression,
  isVec3Expression,
  isVec2Number,
  isVec3Number,

  // Constraint types and creators
  createConstrainedVec2,
  createConstrainedVec3,
  type NumericValueConstraints,
  createConstrainedNumericValue,
} from "./schema/schema";

/**
 * Noise modules
 */
export type { PerlinNoise3DParams } from "./shaders/pnoise/pnoise";
export { $PerlinNoise3D, PerlinNoise3DDescription };

/**
 * Limit modules
 */
export type { LimitParams } from "./shaders/limit/limit";
export { $Limit };

/**
 * Displace modules
 */
export type { DisplaceParams } from "./shaders/displace/displace";
export { $Displace, DisplaceDescription };

/**
 * Add modules
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
