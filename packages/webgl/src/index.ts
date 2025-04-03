import type { JSONSchema7 } from "json-schema";
import { z } from "zod";

import { $Add, $AddJsonSchema, AddDescription } from "./shaders/add";
import {
  $Displace,
  $DisplaceJsonSchema,
  DisplaceDescription,
} from "./shaders/displace";
import { $Limit } from "./shaders/limit";
import {
  $PerlinNoise3D,
  PerlinNoise3DDescription,
  PerlinNoiseJsonSchema,
} from "./shaders/pnoise";

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
  ValueType,

  // Expression utilities
  EXPRESSION_PREFIX,
  isExpressionString,
  createExpressionString,
  expressionToNumericValue,
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
  getNumericValueMode,
  getVec2Mode,
  getVec3Mode,

  // Mode-specific type guards
  isVec2Expression,
  isVec3Expression,
  isVec2Number,
  isVec3Number,
} from "./types/schema";

/**
 * Noise modules
 */
export type { PerlinNoise3DParams } from "./shaders/pnoise";
export { $PerlinNoise3D, PerlinNoise3DDescription };

/**
 * Limit modules
 */
export type { LimitParams } from "./shaders/limit";
export { $Limit };

/**
 * Displace modules
 */
export type { DisplaceParams } from "./shaders/displace";
export { $Displace, DisplaceDescription };

/**
 * Add modules
 */
export type { AddParams } from "./shaders/add";
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
        uniforms: PerlinNoiseJsonSchema,
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

export { addFragmentShader } from "./shaders/add";
export { displaceFragmentShader } from "./shaders/displace";
export { limitFragmentShader } from "./shaders/limit";
export { pnoiseFragmentShader } from "./shaders/pnoise";
export { baseVertexShader } from "./shaders/base-vert-shader";

export { createDefaultAdd } from "./shaders/add";
export { createDefaultDisplace } from "./shaders/displace";
export { createDefaultLimit } from "./shaders/limit";
export { createDefaultPerlinNoise3D } from "./shaders/pnoise";

export { PNOISE_UNIFORM_CONSTRAINTS } from "./shaders/pnoise";
export { LIMIT_UNIFORM_CONSTRAINTS } from "./shaders/limit";
export { DISPLACE_UNIFORM_CONSTRAINTS } from "./shaders/displace";
export { ADD_UNIFORM_CONSTRAINTS } from "./shaders/add";

export {
  getFieldMetadata as getValueFieldMetadata,
  getVec2FieldMetadata,
} from "./shaders/utils";

export * from "./types/field";

export * from "./shaders/utils";

export type {
  UniformFieldValue,
  ValueFieldMetadata,
  Vec2FieldMetadata,
  Vec3FieldMetadata,
} from "./types/field";

// Export Three.js related components
export * from "./components";

// Export Three.js related hooks
export * from "./hooks";

// Export Three.js related utilities
export * from "./utils";

export { createDefaultVec2, createDefaultVec3 } from "./types/schema";
