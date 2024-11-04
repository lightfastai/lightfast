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
export type { PerlinNoise3DParams } from "./shaders/perlin-noise-3d";
export { $PerlinNoise3D } from "./shaders/perlin-noise-3d";
export {
  perlinNoise3DFragmentShader,
  perlinNoise3DVertexShader,
  createDefaultPerlinNoise3D,
} from "./shaders/perlin-noise-3d";

/**
 * limit modules
 */
export type { LimitParams } from "./shaders/limit";
export {
  $Limit,
  createDefaultLimit,
  limitFragmentShader,
  limitVertexShader,
} from "./shaders/limit";
