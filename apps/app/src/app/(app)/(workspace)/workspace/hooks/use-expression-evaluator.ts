/**
 * @deprecated Use the implementation from @repo/threejs instead.
 * This file is kept for backward compatibility and will be removed in a future release.
 */

import type { ExpressionContext, WebGLRootState } from "@repo/threejs";
import {
  evaluateExpression as evaluateThreeJsExpression,
  EXPRESSION_PREFIX,
  extractExpression as extractThreeJsExpression,
  useExpressionEvaluator as useThreeJsExpressionEvaluator,
} from "@repo/threejs";

// Legacy compatibility: check for "$" prefix or "e." prefix expressions
export const isExpression = (value: unknown): value is string => {
  if (typeof value !== "string") return false;
  return value.startsWith("$") || value.startsWith(EXPRESSION_PREFIX);
};

// Legacy compatibility: handle both "$" and "e." expressions
export const extractExpression = (expression: string): string => {
  if (expression.startsWith("$")) {
    return expression.slice(1);
  }
  return extractThreeJsExpression(expression);
};

// Legacy compatibility: handle both "$" and "e." expressions
export const evaluateExpression = (
  expression: string | number | boolean,
  context: Record<string, any>,
): number | boolean => {
  // Convert "$" prefixed expressions to "e." format for the new evaluator
  if (typeof expression === "string" && expression.startsWith("$")) {
    const converted = `${EXPRESSION_PREFIX}{${expression.slice(1)}}`;
    // Ensure context has required ExpressionContext properties
    const expressionContext: ExpressionContext = {
      time: context.time || 0,
      delta: context.delta || 0,
      elapsed: context.elapsed || context.time || 0,
      frame: context.frame || 0,
      fps: context.fps || 0,
      ...context,
    };
    return evaluateThreeJsExpression(converted, expressionContext);
  }

  // Ensure context has required ExpressionContext properties
  const expressionContext: ExpressionContext = {
    time: context.time || 0,
    delta: context.delta || 0,
    elapsed: context.elapsed || context.time || 0,
    frame: context.frame || 0,
    fps: context.fps || 0,
    ...context,
  };
  return evaluateThreeJsExpression(expression, expressionContext);
};

// Wrapper to maintain backward compatibility
export function useExpressionEvaluator() {
  const evaluator = useThreeJsExpressionEvaluator();

  // Return the original implementation with wrapped evaluate function to handle $ prefix
  return {
    ...evaluator,
    evaluate: (
      expression: string | number | undefined,
      state: WebGLRootState,
      defaultValue = 0,
    ): number => {
      if (expression === undefined) return defaultValue;

      // Convert "$" prefixed expressions to "e." format for the new evaluator
      if (typeof expression === "string" && expression.startsWith("$")) {
        const converted = `${EXPRESSION_PREFIX}{${expression.slice(1)}}`;
        return evaluator.evaluate(converted, state, defaultValue);
      }

      return evaluator.evaluate(expression, state, defaultValue);
    },
  };
}
