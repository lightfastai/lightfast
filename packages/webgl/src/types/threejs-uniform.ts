import type { IUniform } from "three";
import type { z } from "zod";
import * as THREE from "three";

import type { UniformFieldValue } from "./field";
import type { ShaderSampler2DUniform } from "./shader-sampler2d-uniform";
import type { NumericValue, Vec2, Vec3 } from "./uniforms";
import { ValueType } from "./uniforms";

export type UniformValue =
  | number
  | THREE.Vector2
  | THREE.Vector3
  | THREE.Texture
  | null;

export type ShaderUniforms = Record<string, IUniform<UniformValue>>;

// Type-safe metadata for uniforms
export interface UniformMetadata<T> {
  type: UniformTypeMap[keyof UniformTypeMap];
  defaultValue?: T;
}

// Map ValueType enum to TypeScript types
export interface UniformTypeMap {
  [ValueType.Numeric]: NumericValue;
  [ValueType.Vec2]: Vec2;
  [ValueType.Vec3]: Vec3;
  [ValueType.Sampler2D]: THREE.Texture | null;
}

export interface UniformAdapter<T, U extends UniformValue> {
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
    return uniform.value;
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
      x: uniform.value.x,
      y: uniform.value.y,
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
      x: uniform.value.x,
      y: uniform.value.y,
      z: uniform.value.z,
    };
  }
}

export class UniformAdapterFactory {
  private static numericAdapter = new NumericUniformAdapter();
  private static vec2Adapter = new Vec2UniformAdapter();
  private static vec3Adapter = new Vec3UniformAdapter();

  static getAdapter(uniformType: ValueType): UniformAdapter<any, UniformValue> {
    switch (uniformType) {
      case ValueType.Numeric:
        return this.numericAdapter;
      case ValueType.Vec2:
        return this.vec2Adapter;
      case ValueType.Vec3:
        return this.vec3Adapter;
      case ValueType.Sampler2D:
        return {
          toThreeUniform: (value) => ({ value: null }),
          fromThreeUniform: (uniform) => uniform.value,
        };
      default:
        throw new Error(`No adapter found for uniform type: ${uniformType}`);
    }
  }
}

// Helper to extract uniform type from constraints
export function getUniformType(constraint: UniformFieldValue): ValueType {
  return constraint.type;
}

// Type-safe creation of uniforms from Zod schema and constraints
export function createUniformsFromSchema<T extends z.ZodType>(
  values: z.infer<T>,
  constraints: Record<string, UniformFieldValue>,
): ShaderUniforms {
  const uniforms: ShaderUniforms = {};
  for (const [key, value] of Object.entries(values)) {
    const constraint = constraints[key];
    if (constraint) {
      const adapter = UniformAdapterFactory.getAdapter(
        getUniformType(constraint),
      );
      uniforms[key] = adapter.toThreeUniform(value);
    }
  }

  return uniforms;
}

// Type-safe uniform updates using constraints
export function updateUniforms<T extends z.ZodType>(
  shader: THREE.ShaderMaterial,
  values: z.infer<T>,
  constraints: Record<string, UniformFieldValue>,
): void {
  for (const [key, value] of Object.entries(values)) {
    const constraint = constraints[key];
    if (shader.uniforms[key] && constraint) {
      const adapter = UniformAdapterFactory.getAdapter(
        getUniformType(constraint),
      );
      shader.uniforms[key] = adapter.toThreeUniform(value);
    }
  }
}

// Type-safe sampler uniform updates
export function updateSamplerUniforms(
  shader: THREE.ShaderMaterial,
  textureMap: Record<string, THREE.Texture | null>,
): void {
  for (const [key, texture] of Object.entries(textureMap)) {
    if (shader.uniforms[key]) {
      shader.uniforms[key].value = texture;
    }
  }
}

/**
 * Create default uniforms from texture handles
 * @param handles Array of texture handles
 * @returns Object with default uniforms initialized to null
 */
export function createDefaultUniforms(
  handles: ShaderSampler2DUniform[],
): ShaderUniforms {
  const uniforms: ShaderUniforms = {};

  handles.forEach((handle) => {
    uniforms[handle.uniformName] = {
      value: null,
    };
  });

  return uniforms;
}

/**
 * Create a texture uniform with a systematic naming convention
 * @param textureNumber The texture number (1-based index)
 * @returns A uniform object with null value
 */
export function createTextureUniform(
  textureNumber: number,
): IUniform<THREE.Texture | null> {
  return { value: null };
}

/**
 * Check if a uniform name is a texture uniform (follows the u_textureN pattern)
 * @param uniformName The uniform name to check
 * @returns True if it's a texture uniform
 */
export function isTextureUniform(uniformName: string): boolean {
  return /^u_texture\d+$/.test(uniformName);
}

/**
 * Update shader uniforms with texture uniforms
 * @param shader The shader material to update
 * @param uniforms The uniforms object containing texture values
 * @param handles Array of texture handles defining the mapping
 */
export function updateShaderUniforms(
  shader: THREE.ShaderMaterial,
  uniforms: ShaderUniforms,
  handles: ShaderSampler2DUniform[],
): void {
  handles.forEach((handle) => {
    const uniformName = handle.uniformName;
    const uniform = uniforms[uniformName]?.value;
    if (uniform && shader.uniforms[uniformName]) {
      shader.uniforms[uniformName].value = uniform;
    }
  });
}

/**
 * Update shader texture uniforms directly from a map of handle IDs to textures
 * @param shader The shader material to update
 * @param textureMap Map of handle IDs to textures
 * @param handles Array of texture handles defining the mapping
 */
export function updateShaderTextureUniforms(
  shader: THREE.ShaderMaterial,
  textureMap: Record<string, THREE.Texture | null>,
  handles: ShaderSampler2DUniform[],
): void {
  handles.forEach((handle) => {
    const { handleId, uniformName } = handle;
    const texture = textureMap[handleId];

    if (shader.uniforms[uniformName]) {
      shader.uniforms[uniformName].value = texture;
    }
  });
}

// Type-safe shader material creation
export function createShaderMaterial(
  vertexShader: string,
  fragmentShader: string,
  uniforms: ShaderUniforms,
): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms,
    vertexShader,
    fragmentShader,
  });
}
