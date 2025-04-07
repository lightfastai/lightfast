import type { IUniform } from "three";
import * as THREE from "three";

import type { ShaderSampler2DUniform } from "../types/shader-sampler2d-uniform";
import type { ShaderUniform } from "../types/shader-uniform";
import { isShaderUniform } from "../types/shader-uniform";

/**
 * Interface for shader uniforms
 */
export type ShaderUniforms = Record<
  string,
  IUniform<
    | ShaderUniform
    | number
    | THREE.Vector2
    | THREE.Vector3
    | THREE.Vector4
    | null
  >
>;

/**
 * Create default uniforms from texture handles
 */
export function createDefaultUniforms(
  handles: ShaderSampler2DUniform[],
): ShaderUniforms {
  const uniforms: ShaderUniforms = {};

  handles.forEach((handle) => {
    uniforms[handle.uniformName] = {
      value: {
        handle: null,
        textureObject: null,
      },
    };
  });

  return uniforms;
}

/**
 * Update shader uniforms with texture uniforms
 */
export function updateShaderUniforms(
  shader: THREE.ShaderMaterial,
  uniforms: ShaderUniforms,
  handles: ShaderSampler2DUniform[],
): void {
  handles.forEach((handle) => {
    const uniformName = handle.uniformName;
    const uniform = uniforms[uniformName]?.value;
    if (isShaderUniform(uniform) && shader.uniforms[uniformName]) {
      shader.uniforms[uniformName].value = uniform.textureObject;
    }
  });
}

/**
 * Create a shader material with default uniforms
 */
export function createShaderMaterial(
  vertexShader: string,
  fragmentShader: string,
  handles: ShaderSampler2DUniform[],
): THREE.ShaderMaterial {
  const uniforms = createDefaultUniforms(handles);

  return new THREE.ShaderMaterial({
    uniforms,
    vertexShader,
    fragmentShader,
  });
}
