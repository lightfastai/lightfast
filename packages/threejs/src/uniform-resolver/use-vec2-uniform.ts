"use client";

import type { ShaderMaterial } from "three";
import { useCallback } from "react";

import type { Vec2 } from "@repo/webgl";
import { ValueType } from "@repo/webgl";

import type { WebGLRootState } from "../types/render";
import { ExpressionAdapterFactory } from "./expression-evaluator/expression-adapters";
import { useExpression } from "./expression-evaluator/use-expression";

/**
 * Hook for handling Vec2 uniform updates with expression support
 */
export function useVec2Uniform() {
  // Get the evaluate function from useExpression
  const { evaluate } = useExpression();

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
        // Just update with the Vec2 value (no expressions)
        shader.uniforms[uniformName] = adapter.createUniformValue(value, {});
      }
    },
    [evaluate],
  );

  /**
   * Updates multiple Vec2 uniforms at once
   */
  const updateVec2Uniforms = useCallback(
    (
      state: WebGLRootState,
      shader: ShaderMaterial,
      uniforms: Record<string, Vec2>,
    ) => {
      for (const [uniformName, value] of Object.entries(uniforms)) {
        updateVec2Uniform(state, shader, uniformName, value);
      }
    },
    [updateVec2Uniform],
  );

  return {
    updateVec2Uniform,
    updateVec2Uniforms,
  };
}
