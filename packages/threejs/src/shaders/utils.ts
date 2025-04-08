import * as THREE from "three";

import type { R3FShaderUniforms } from "@repo/webgl";
import {
  isNumericValue,
  isVec2,
  isVec3,
  R3FUniformAdapterFactory,
  ValueType,
} from "@repo/webgl";

export function createR3FShaderMaterial(
  vertexShader: string,
  fragmentShader: string,
  uniforms: R3FShaderUniforms,
): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms,
    vertexShader,
    fragmentShader,
  });
}

/**
 * Use the adapter factory to update a specific uniform
 * @todo Handle uniformType === ValueType.Sampler2D
 * @todo Handle case where the uniform is not found; right now it throws an error
 * @todo Possible to use Generics to add type safety surrouding key & value!?
 */
export const updateR3FShaderUniform = (
  shader: THREE.ShaderMaterial,
  key: string,
  value: unknown,
  uniformType: ValueType,
): void => {
  if (!shader.uniforms[key]) {
    throw new Error(`Uniform ${key} not found`);
  }
  const adapter = R3FUniformAdapterFactory.getAdapter(uniformType);
  if (
    (uniformType === ValueType.Numeric && isNumericValue(value)) ||
    (uniformType === ValueType.Vec2 && isVec2(value)) ||
    (uniformType === ValueType.Vec3 && isVec3(value))
  ) {
    shader.uniforms[key] = adapter.toThreeUniform(value);
  }
};
