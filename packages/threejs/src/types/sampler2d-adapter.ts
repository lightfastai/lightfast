"use client";

import type { IUniform } from "three";
import type * as THREE from "three";

import type { Sampler2D } from "@repo/webgl";

/**
 * Adapter for Sampler2D uniforms
 * Follows the pattern established in other adapter implementations
 */
export interface Sampler2DAdapter {
  /**
   * Convert a Sampler2D object to a THREE.js uniform
   * @param value The Sampler2D value to convert
   * @param textureResolver Function to resolve a texture from a Sampler2D object
   */
  toThreeUniform(
    value: Sampler2D,
    uniformName: string,
    textureResolver: (uniformName: string) => THREE.Texture | null,
  ): IUniform<THREE.Texture | null>;

  /**
   * Convert a THREE.js uniform back to a Sampler2D object
   * @param uniform The uniform containing a texture
   */
  fromThreeUniform(uniform: IUniform<THREE.Texture | null>): Sampler2D;
}

/**
 * Implementation of the Sampler2D adapter
 */
export class Sampler2DUniformAdapter implements Sampler2DAdapter {
  toThreeUniform(
    value: Sampler2D,
    uniformName: string,
    textureResolver: (uniformName: string) => THREE.Texture | null,
  ): IUniform<THREE.Texture | null> {
    // If a texture resolver is provided, use it to get the actual texture
    return { value: textureResolver(uniformName) };
  }

  fromThreeUniform(uniform: IUniform<THREE.Texture | null>): Sampler2D {
    // When converting back, we can't know the original vuvID
    // This would typically be handled by storing the mapping separately
    return { vuvID: null };
  }
}

/**
 * Factory to create and manage Sampler2D adapters
 */
export class Sampler2DAdapterFactory {
  private static sampler2DAdapter = new Sampler2DUniformAdapter();

  /**
   * Get the Sampler2D adapter
   */
  static getAdapter(): Sampler2DAdapter {
    return this.sampler2DAdapter;
  }
}
