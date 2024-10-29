import type * as THREE from "three";

export type UniformValue =
  | number
  | boolean
  | THREE.Vector2
  | THREE.Vector3
  | THREE.Vector4
  | THREE.Color
  | THREE.Texture
  | THREE.CubeTexture
  | THREE.Matrix3
  | THREE.Matrix4
  | THREE.Quaternion
  | any[];

export interface Uniform {
  value: UniformValue;
}
