"use client";

import type { ShaderMaterial } from "three";
import { useCallback } from "react";

import type { Vec3 } from "@repo/webgl";
import { ValueType } from "@repo/webgl";

import type { WebGLRootState } from "../types/render";
import { ExpressionAdapterFactory } from "./expression-evaluator/expression-adapters";
import { useExpression } from "./expression-evaluator/use-expression";

/**
 * Hook for handling Vec3 uniform updates with expression support
 */
export function useVec3Uniform() {
  // Get the evaluate function from useExpression
  const { evaluate } = useExpression();

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
        // Just update with the Vec3 value (no expressions)
        shader.uniforms[uniformName] = adapter.createUniformValue(value, {});
      }
    },
    [evaluate],
  );

  /**
   * Updates multiple Vec3 uniforms at once
   */
  const updateVec3Uniforms = useCallback(
    (
      state: WebGLRootState,
      shader: ShaderMaterial,
      uniforms: Record<string, Vec3>,
    ) => {
      for (const [uniformName, value] of Object.entries(uniforms)) {
        updateVec3Uniform(state, shader, uniformName, value);
      }
    },
    [updateVec3Uniform],
  );

  return {
    updateVec3Uniform,
    updateVec3Uniforms,
  };
}
