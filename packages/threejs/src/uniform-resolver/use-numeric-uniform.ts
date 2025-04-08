"use client";

import type { ShaderMaterial } from "three";
import { useCallback } from "react";

import type { NumericValue } from "@repo/webgl";
import { ValueType } from "@repo/webgl";

import type { WebGLRootState } from "../types/render";
import { ExpressionAdapterFactory } from "./expression-evaluator/expression-adapters";
import { useExpression } from "./expression-evaluator/use-expression";

/**
 * Hook for handling numeric uniform updates with expression support
 */
export function useNumericUniform() {
  // Get the evaluate function from useExpression
  const { evaluate } = useExpression();

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
   * Updates multiple numeric uniforms at once
   */
  const updateNumericUniforms = useCallback(
    (
      state: WebGLRootState,
      shader: ShaderMaterial,
      uniforms: Record<string, NumericValue>,
    ) => {
      for (const [uniformName, value] of Object.entries(uniforms)) {
        updateNumericUniform(state, shader, uniformName, value);
      }
    },
    [updateNumericUniform],
  );

  return {
    updateNumericUniform,
    updateNumericUniforms,
  };
}
