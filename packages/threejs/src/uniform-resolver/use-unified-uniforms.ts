"use client";

import type { ShaderMaterial } from "three";
import type * as THREE from "three";
import { useCallback } from "react";

import type { UniformFieldValue } from "@repo/webgl";
import {
  isBoolean,
  isColor,
  isNumericValue,
  isSampler2D,
  isString,
  isVec2,
  isVec3,
  ValueType,
} from "@repo/webgl";

import type { WebGLRootState } from "../types/render";
import { useExpression } from "../expression-evaluator/use-expression";
import { useSampler2D } from "./use-sampler2d";

/**
 * Unified hook for updating all types of shader uniforms with expression support
 * Handles different uniform types and only updates each uniform once
 */
export function useUnifiedUniforms() {
  // Get expression evaluation functions from useExpression
  const { updateNumericUniform, updateVec2Uniform, updateVec3Uniform } =
    useExpression();
  const { updateSampler2DUniform } = useSampler2D();

  /**
   * Determines the ValueType of a given uniform value
   */
  const determineValueType = useCallback((value: unknown): ValueType => {
    if (isNumericValue(value)) return ValueType.Numeric;
    if (isVec2(value)) return ValueType.Vec2;
    if (isVec3(value)) return ValueType.Vec3;
    if (isBoolean(value)) return ValueType.Boolean;
    if (isColor(value)) return ValueType.Color;
    if (isString(value)) return ValueType.String;
    if (value && typeof value === "object" && "vuvID" in value)
      return ValueType.Sampler2D;

    // Default fallback
    return ValueType.String;
  }, []);

  /**
   * Updates all uniform values in a shader, with expression evaluation where applicable
   * @param state Current WebGL state for expression evaluation
   * @param shader The shader material to update
   * @param uniforms The uniform values to apply
   * @param constraints Optional constraints/metadata about the uniforms
   * @param textureResolver Optional function to resolve textures from Sampler2D objects
   */
  const updateAllUniforms = useCallback(
    (
      state: WebGLRootState,
      shader: ShaderMaterial,
      uniforms: Record<string, unknown>,
      constraints?: Record<string, UniformFieldValue>,
      textureResolver?: (
        sampler: Record<string, unknown>,
      ) => THREE.Texture | null,
    ) => {
      for (const [uniformName, value] of Object.entries(uniforms)) {
        // Skip if the uniform doesn't exist in the shader
        if (!shader.uniforms[uniformName]) continue;

        // Get constraint if available, otherwise determine the value type
        const constraint = constraints?.[uniformName];
        const valueType = constraint?.type ?? determineValueType(value);

        // Update based on value type
        switch (valueType) {
          case ValueType.Numeric:
            if (isNumericValue(value)) {
              updateNumericUniform(state, shader, uniformName, value);
            }
            break;

          case ValueType.Vec2:
            if (isVec2(value)) {
              updateVec2Uniform(state, shader, uniformName, value);
            }
            break;

          case ValueType.Vec3:
            if (isVec3(value)) {
              updateVec3Uniform(state, shader, uniformName, value);
            }
            break;

          case ValueType.Sampler2D:
            // Use the dedicated function for Sampler2D uniforms
            if (isSampler2D(value)) {
              updateSampler2DUniform(
                shader,
                uniformName,
                value,
                textureResolver,
              );
            }
            break;

          case ValueType.Boolean:
          case ValueType.Color:
          case ValueType.String:
            // Direct assignment for types without expressions
            shader.uniforms[uniformName].value = value;
            break;

          default:
            // For any unhandled type, assign directly
            shader.uniforms[uniformName].value = value;
        }
      }
    },
    [
      updateNumericUniform,
      updateVec2Uniform,
      updateVec3Uniform,
      updateSampler2DUniform,
      determineValueType,
    ],
  );

  /**
   * Updates texture sampler uniforms
   * @param shader The shader material to update
   * @param textureMap Map of uniform names to textures
   */
  const updateTextureUniforms = useCallback(
    (shader: ShaderMaterial, textureMap: Record<string, unknown>) => {
      for (const [uniformName, texture] of Object.entries(textureMap)) {
        if (shader.uniforms[uniformName]) {
          shader.uniforms[uniformName].value = texture;
        }
      }
    },
    [],
  );

  return {
    updateAllUniforms,
    updateTextureUniforms,
    updateSampler2DUniform,
    determineValueType,
  };
}
