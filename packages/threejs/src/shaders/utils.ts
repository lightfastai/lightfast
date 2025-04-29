import * as THREE from "three";

import type { R3FShaderUniforms } from "../types/shader-uniforms";

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
