import type { ValueType } from "./shaders/enums/values";
import type { VectorMode } from "./shaders/enums/vector-mode";
import { $ValueType } from "./shaders/enums/values";
import { $VectorMode } from "./shaders/enums/vector-mode";
import { getFieldMetadata } from "./shaders/field";

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
  isSampler2D,
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

  // Default values
  createDefaultVec2,
  createDefaultVec3,
} from "./shaders/uniforms";

export { $VectorMode, $ValueType, type VectorMode, type ValueType };

/**
 * Shader definitions and implementations
 */
export {
  addShaderDefinition,
  addFragmentShader,
  ADD_UNIFORM_CONSTRAINTS,
  createDefaultAdd,
  $Add,
  type AddParams,
} from "./shaders/impl/add";

export {
  displaceShaderDefinition,
  displaceFragmentShader,
  DISPLACE_UNIFORM_CONSTRAINTS,
  createDefaultDisplace,
  $Displace,
  type DisplaceParams,
} from "./shaders/impl/displace";

export {
  limitShaderDefinition,
  limitFragmentShader,
  LIMIT_UNIFORM_CONSTRAINTS,
  createDefaultLimit,
  $Limit,
  type LimitParams,
} from "./shaders/impl/limit";

export {
  pnoiseShaderDefinition,
  pnoiseFragmentShader,
  PNOISE_UNIFORM_CONSTRAINTS,
  createDefaultPerlinNoise2D,
  $PerlinNoise2D,
  type PerlinNoise2DParams,
} from "./shaders/impl/pnoise";

export { baseVertexShader } from "./shaders/base-vert-shader";

/**
 * Uniform fields and types
 */
export type {
  UniformFieldValue,
  ValueFieldMetadata,
  Vec2FieldMetadata,
  Vec3FieldMetadata,
  Sampler2DMetadata,
} from "./shaders/field";

export * from "./shaders/interfaces/sampler2d-handle";

/**
 * Registry functions and texture handling
 */
export {
  getShaderDefinition,
  isShaderRegistered,
  getAllShaderTypes,
  textureInputRegistry,
  getShaderSampler2DInputsForType,
  createSampler2DFieldMetadata,
} from "./registry";

// Export shader enums
export * from "./shaders/enums/shaders";

export { getFieldMetadata };
