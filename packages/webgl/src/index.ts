import { $Add } from "./shaders/add";
import { $Displace } from "./shaders/displace";
import { $Limit } from "./shaders/limit";
import { $PerlinNoise2D } from "./shaders/pnoise";

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
} from "./types/uniforms";

/**
 * Noise modules
 */
export type { PerlinNoise2DParams } from "./shaders/pnoise";
export { $PerlinNoise2D };

/**
 * Limit modules
 */
export type { LimitParams } from "./shaders/limit";
export { $Limit };

/**
 * Displace modules
 */
export type { DisplaceParams } from "./shaders/displace";
export { $Displace };

/**
 * Add modules
 */
export type { AddParams } from "./shaders/add";
export { $Add };

/**
 * Texture uniforms and registry
 */
export * from "./registry/shader-sampler2d-uniform-registry";

/**
 * Shared texture uniforms type
 */
export const $TextureUniforms = $PerlinNoise2D
  .merge($Limit)
  .merge($Displace)
  .merge($Add);

export { addFragmentShader } from "./shaders/add";
export { displaceFragmentShader } from "./shaders/displace";
export { limitFragmentShader } from "./shaders/limit";
export { pnoiseFragmentShader } from "./shaders/pnoise";
export { baseVertexShader } from "./shaders/base-vert-shader";

export { createDefaultAdd } from "./shaders/add";
export { createDefaultDisplace as createDefaultDisplace } from "./shaders/displace";
export { createDefaultLimit } from "./shaders/limit";
export { createDefaultPerlinNoise2D } from "./shaders/pnoise";

export { PNOISE_UNIFORM_CONSTRAINTS } from "./shaders/pnoise";
export { LIMIT_UNIFORM_CONSTRAINTS } from "./shaders/limit";
export { DISPLACE_UNIFORM_CONSTRAINTS } from "./shaders/displace";
export { ADD_UNIFORM_CONSTRAINTS } from "./shaders/add";

export { getFieldMetadata as getValueFieldMetadata } from "./shaders/utils";

export * from "./types/field";
export * from "./registry/shader-sampler2d-uniform-registry";
export * from "./shaders/utils";

export type {
  UniformFieldValue,
  ValueFieldMetadata,
  Vec2FieldMetadata,
  Vec3FieldMetadata,
} from "./types/field";

export { createDefaultVec2, createDefaultVec3 } from "./types/uniforms";

export * from "./types/shader-sampler2d-uniform";

export {
  getShaderSampler2DInputsForType,
  isValidSampler2DHandleForType,
  type ShaderSampler2DUniformRegistry as ShaderSampler2DRegistry,
} from "./registry/shader-sampler2d-uniform-registry";

// Export types
export * from "./types/shader-sampler2d-uniform";
export * from "./types/field";
export * from "./types/uniforms";
export * from "./types/shaders-types";

// Export shaders
export * from "./shaders/add";
export * from "./shaders/displace";
export * from "./shaders/limit";
export * from "./shaders/pnoise";
export * from "./shaders/utils";
export * from "./shaders/base-vert-shader";

// Export types
export * from "./types/field";
export * from "./types/shader-sampler2d-uniform";
export * from "./types/threejs-uniform";
export * from "./types/uniforms";
