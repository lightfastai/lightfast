import type { ValueType } from "./shaders/enums/values";
import type { VectorMode } from "./shaders/enums/vector-mode";
import { $ValueType } from "./shaders/enums/values";
import { $VectorMode } from "./shaders/enums/vector-mode";
import { $Add } from "./shaders/impl/add";
import { $Displace } from "./shaders/impl/displace";
import { $Limit } from "./shaders/impl/limit";
import { $PerlinNoise2D } from "./shaders/impl/pnoise";

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
} from "./shaders/uniforms";

export { $VectorMode, $ValueType, type VectorMode, type ValueType };

/**
 * Noise modules
 */
export type { PerlinNoise2DParams } from "./shaders/impl/pnoise";
export { $PerlinNoise2D };

/**
 * Limit modules
 */
export type { LimitParams } from "./shaders/impl/limit";
export { $Limit };

/**
 * Displace modules
 */
export type { DisplaceParams } from "./shaders/impl/displace";
export { $Displace };

/**
 * Add modules
 */
export type { AddParams } from "./shaders/impl/add";
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

export { addFragmentShader } from "./shaders/impl/add";
export { displaceFragmentShader } from "./shaders/impl/displace";
export { limitFragmentShader } from "./shaders/impl/limit";
export { pnoiseFragmentShader } from "./shaders/impl/pnoise";
export { baseVertexShader } from "./shaders/base-vert-shader";

export { createDefaultAdd } from "./shaders/impl/add";
export { createDefaultDisplace as createDefaultDisplace } from "./shaders/impl/displace";
export { createDefaultLimit } from "./shaders/impl/limit";
export { createDefaultPerlinNoise2D } from "./shaders/impl/pnoise";

export { PNOISE_UNIFORM_CONSTRAINTS } from "./shaders/impl/pnoise";
export { LIMIT_UNIFORM_CONSTRAINTS } from "./shaders/impl/limit";
export { DISPLACE_UNIFORM_CONSTRAINTS } from "./shaders/impl/displace";
export { ADD_UNIFORM_CONSTRAINTS } from "./shaders/impl/add";

export * from "./shaders/field";
export * from "./registry/shader-sampler2d-uniform-registry";

export type {
  UniformFieldValue,
  ValueFieldMetadata,
  Vec2FieldMetadata,
  Vec3FieldMetadata,
} from "./shaders/field";

export { createDefaultVec2, createDefaultVec3 } from "./shaders/uniforms";

export * from "./uniforms/handle";

export {
  getShaderSampler2DInputsForType,
  isValidSampler2DHandleForType,
  type ShaderSampler2DUniformRegistry as ShaderSampler2DRegistry,
} from "./registry/shader-sampler2d-uniform-registry";

// Export types
export * from "./uniforms/handle";
export * from "./shaders/field";
export * from "./shaders/uniforms";
export * from "./shaders/enums/shaders";

// Export shaders
export * from "./shaders/impl/add";
export * from "./shaders/impl/displace";
export * from "./shaders/impl/limit";
export * from "./shaders/impl/pnoise";
export * from "./shaders/base-vert-shader";

// Export types
export * from "./shaders/field";
export * from "./uniforms/handle";
export * from "./shaders/uniforms";

export * from "./registry";
