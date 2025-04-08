"use client";

import type { ShaderMaterial } from "three";
import { useCallback } from "react";

import type { NumericValue, UniformFieldValue, Vec2, Vec3 } from "@repo/webgl";
import { isNumericValue, isVec2, isVec3, ValueType } from "@repo/webgl";

import type { WebGLRootState } from "../types/render";
import { ExpressionAdapterFactory } from "../types/expression-adapters";
import { useExpressionEvaluator } from "./use-expression-evaluator";

/**
 * Interface for uniform with possible expressions
 */
export interface UniformWithExpressions<T> {
  uniformName: string;
  value: T;
  type: ValueType;
}

/**
 * Hook for handling uniform expressions using the expression adapters
 */
export function useExpressionUniform() {
  const { evaluate } = useExpressionEvaluator();

  /**
   * Updates a NumericValue uniform that may contain an expression
   */
  const updateNumericUniform = useCallback(
    (
      state: WebGLRootState,
      shader: ShaderMaterial,
      uniformName: string,
      value: NumericValue,
    ) => {
      // Get the adapter for numeric values
      const adapter = ExpressionAdapterFactory.getAdapter(ValueType.Numeric);

      // Skip if the uniform doesn't exist
      if (!shader.uniforms[uniformName]) return;

      // Check if the value has expressions
      if (adapter.hasExpressions(value)) {
        // Extract expressions
        const expressions = adapter.toExpression(value);

        // Evaluate expressions
        const expressionResults: Record<string, number> = {};
        for (const [key, expr] of Object.entries(expressions)) {
          if (expr) {
            expressionResults[key] = evaluate(expr, state);
          }
        }

        // Create and update the uniform
        shader.uniforms[uniformName] = adapter.createUniformValue(
          value,
          expressionResults,
        );
      } else {
        // Just update with the numeric value (no expressions)
        shader.uniforms[uniformName] = adapter.createUniformValue(value, {});
      }
    },
    [evaluate],
  );

  /**
   * Updates a Vec2 uniform that may contain expressions
   */
  const updateVec2Uniform = useCallback(
    (
      state: WebGLRootState,
      shader: ShaderMaterial,
      uniformName: string,
      value: Vec2,
    ) => {
      // Get the adapter for Vec2 values
      const adapter = ExpressionAdapterFactory.getAdapter(ValueType.Vec2);

      // Skip if the uniform doesn't exist
      if (!shader.uniforms[uniformName]) return;

      // Check if the value has expressions
      if (adapter.hasExpressions(value)) {
        // Extract expressions
        const expressions = adapter.toExpression(value);

        // Evaluate expressions
        const expressionResults: Record<string, number> = {};
        for (const [key, expr] of Object.entries(expressions)) {
          if (expr) {
            expressionResults[key] = evaluate(expr, state);
          }
        }

        // Create and update the uniform
        shader.uniforms[uniformName] = adapter.createUniformValue(
          value,
          expressionResults,
        );
      } else {
        // Just update with the numeric value (no expressions)
        shader.uniforms[uniformName] = adapter.createUniformValue(value, {});
      }
    },
    [evaluate],
  );

  /**
   * Updates a Vec3 uniform that may contain expressions
   */
  const updateVec3Uniform = useCallback(
    (
      state: WebGLRootState,
      shader: ShaderMaterial,
      uniformName: string,
      value: Vec3,
    ) => {
      // Get the adapter for Vec3 values
      const adapter = ExpressionAdapterFactory.getAdapter(ValueType.Vec3);

      // Skip if the uniform doesn't exist
      if (!shader.uniforms[uniformName]) return;

      // Check if the value has expressions
      if (adapter.hasExpressions(value)) {
        // Extract expressions
        const expressions = adapter.toExpression(value);

        // Evaluate expressions
        const expressionResults: Record<string, number> = {};
        for (const [key, expr] of Object.entries(expressions)) {
          if (expr) {
            expressionResults[key] = evaluate(expr, state);
          }
        }

        // Create and update the uniform
        shader.uniforms[uniformName] = adapter.createUniformValue(
          value,
          expressionResults,
        );
      } else {
        // Just update with the numeric value (no expressions)
        shader.uniforms[uniformName] = adapter.createUniformValue(value, {});
      }
    },
    [evaluate],
  );

  /**
   * Updates uniforms that may contain expressions
   */
  const updateUniformsWithExpressions = useCallback(
    (
      state: WebGLRootState,
      shader: ShaderMaterial,
      uniforms: (
        | UniformWithExpressions<NumericValue>
        | UniformWithExpressions<Vec2>
        | UniformWithExpressions<Vec3>
      )[],
    ) => {
      // Process each uniform
      uniforms.forEach((uniform) => {
        const { uniformName, value, type } = uniform;

        // Update based on type
        switch (type) {
          case ValueType.Numeric:
            updateNumericUniform(
              state,
              shader,
              uniformName,
              value as NumericValue,
            );
            break;

          case ValueType.Vec2:
            updateVec2Uniform(state, shader, uniformName, value as Vec2);
            break;

          case ValueType.Vec3:
            updateVec3Uniform(state, shader, uniformName, value as Vec3);
            break;

          default:
            // Other types not supported
            break;
        }
      });
    },
    [updateNumericUniform, updateVec2Uniform, updateVec3Uniform],
  );

  /**
   * Updates uniforms from constraints and values that may contain expressions
   */
  const updateUniformsFromConstraints = useCallback(
    <T extends Record<string, NumericValue | Vec2 | Vec3>>(
      state: WebGLRootState,
      shader: ShaderMaterial,
      constraints: Record<string, UniformFieldValue>,
      values: T,
    ) => {
      // Process each value
      for (const [uniformName, value] of Object.entries(values)) {
        // Get constraint
        const constraint = constraints[uniformName];
        if (!constraint) continue;

        // Update based on type
        switch (constraint.type) {
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

          default:
            // Other types not supported
            break;
        }
      }
    },
    [updateNumericUniform, updateVec2Uniform, updateVec3Uniform],
  );

  return {
    updateNumericUniform,
    updateVec2Uniform,
    updateVec3Uniform,
    updateUniformsWithExpressions,
    updateUniformsFromConstraints,
  };
}
