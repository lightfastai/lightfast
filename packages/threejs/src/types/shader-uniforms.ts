import type { IUniform } from "three";
import * as THREE from "three";

import type {
  NumericValue,
  Sampler2D,
  ValueType,
  Vec2,
  Vec3,
} from "@repo/webgl";
import { $ValueType } from "@repo/webgl";

export type R3FShaderUniformValue =
  | number
  | THREE.Vector2
  | THREE.Vector3
  | THREE.Texture
  | null;

export type R3FShaderUniforms = Record<string, IUniform<R3FShaderUniformValue>>;

// Type-safe metadata for uniforms
export interface UniformMetadata<T> {
  type: UniformTypeMap[keyof UniformTypeMap];
  defaultValue?: T;
}

// Map ValueType enum to TypeScript types
export interface UniformTypeMap {
  [$ValueType.enum.Numeric]: NumericValue;
  [$ValueType.enum.Vec2]: Vec2;
  [$ValueType.enum.Vec3]: Vec3;
  [$ValueType.enum.Sampler2D]: Sampler2D;
}

export interface UniformAdapter<T, U extends R3FShaderUniformValue> {
  toThreeUniform(value: T): IUniform<U>;
  fromThreeUniform(uniform: IUniform<U>): T;
}

export class NumericUniformAdapter
  implements UniformAdapter<NumericValue, number>
{
  toThreeUniform(value: NumericValue): IUniform<number> {
    return { value: typeof value === "number" ? value : 0 };
  }

  fromThreeUniform(uniform: IUniform<number>): NumericValue {
    return Number(uniform.value);
  }
}

export class Vec2UniformAdapter implements UniformAdapter<Vec2, THREE.Vector2> {
  toThreeUniform(value: Vec2): IUniform<THREE.Vector2> {
    return {
      value: new THREE.Vector2(
        typeof value.x === "number" ? value.x : 0,
        typeof value.y === "number" ? value.y : 0,
      ),
    };
  }

  fromThreeUniform(uniform: IUniform<THREE.Vector2>): Vec2 {
    return {
      x: Number(uniform.value.x),
      y: Number(uniform.value.y),
    };
  }
}

export class Vec3UniformAdapter implements UniformAdapter<Vec3, THREE.Vector3> {
  toThreeUniform(value: Vec3): IUniform<THREE.Vector3> {
    return {
      value: new THREE.Vector3(
        typeof value.x === "number" ? value.x : 0,
        typeof value.y === "number" ? value.y : 0,
        typeof value.z === "number" ? value.z : 0,
      ),
    };
  }

  fromThreeUniform(uniform: IUniform<THREE.Vector3>): Vec3 {
    return {
      x: Number(uniform.value.x),
      y: Number(uniform.value.y),
      z: Number(uniform.value.z),
    };
  }
}

export class R3FUniformAdapterFactory {
  private static numericAdapter = new NumericUniformAdapter();
  private static vec2Adapter = new Vec2UniformAdapter();
  private static vec3Adapter = new Vec3UniformAdapter();

  static getAdapter(
    uniformType: ValueType,
  ): UniformAdapter<unknown, R3FShaderUniformValue> {
    switch (uniformType) {
      case $ValueType.enum.Numeric:
        return this.numericAdapter;
      case $ValueType.enum.Vec2:
        return this.vec2Adapter;
      case $ValueType.enum.Vec3:
        return this.vec3Adapter;
      case $ValueType.enum.Sampler2D:
        return {
          toThreeUniform: (value) => ({ value: null }),
          fromThreeUniform: (uniform) => uniform.value,
        };
      default:
        throw new Error(`No adapter found for uniform type: ${uniformType}`);
    }
  }
}
