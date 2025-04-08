import type {
  ExpressionResult,
  ExpressionTimeContext,
} from "@/uniform-resolver/expression-evaluator/types";

import {
  extractExpression,
  isBoolean,
  isExpression,
  isNumber,
} from "@repo/webgl";

import type { WebGLRootState } from "../../types/render";
import { getNestedValue } from "../../hooks/utils";

/**
 * Evaluates a string expression with the provided context
 */

export const evaluateExpression = (
  expression: string | number | boolean,
  context: ExpressionTimeContext,
): ExpressionResult => {
  // If it's already a number or boolean, return it directly
  if (isNumber(expression)) {
    return expression;
  }
  if (isBoolean(expression)) {
    return expression;
  }

  try {
    // Only evaluate if it's an expression string (starts with e.)
    if (!isExpression(expression)) {
      // For non-expression strings, try to convert to number
      const num = Number(expression);
      return isNaN(num) ? 0 : num;
    }

    // Extract the actual expression from the prefixed format
    const extractedExpression = extractExpression(expression);

    // Replace variables with their values from context
    let evalExpression = extractedExpression;

    // Find all potential variable paths in the expression
    const variableRegex = /\b[a-zA-Z_][a-zA-Z0-9_.]*\b/g;
    const matches = evalExpression.match(variableRegex) || [];

    // Replace each match with its corresponding value
    matches.forEach((match) => {
      const value = getNestedValue(context, match);
      if (value !== undefined && value !== null) {
        evalExpression = evalExpression.replace(
          new RegExp(`\\b${match}\\b`, "g"),
          String(value),
        );
      }
    });

    // Use Function constructor to safely evaluate the expression
    const func = new Function("return " + evalExpression);
    const result = func();

    // Return result with appropriate type
    return typeof result === "boolean" ? result : Number(result);
  } catch (error) {
    console.error(
      "Error evaluating expression:",
      error,
      "in expression:",
      expression,
    );
    // Return a default value if evaluation fails
    return typeof expression === "string" && expression.includes("time")
      ? context.time * 0.1
      : 0;
  }
};
/**
 * Creates a time context object with current time values from Three.js
 */

export const createTimeContext = (
  state: WebGLRootState,
  frameCount = 0,
): ExpressionTimeContext => {
  const elapsedTime = state.clock.elapsedTime;
  const deltaTime = state.clock.getDelta();
  const fps = state.frameloop === "always" ? 60 : 0; // Basic FPS estimate

  return {
    time: elapsedTime,
    delta: deltaTime,
    elapsed: elapsedTime,
    frame: frameCount,
    fps: fps,
  };
};
