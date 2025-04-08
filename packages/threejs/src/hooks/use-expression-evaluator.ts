"use client";

import type { IUniform, ShaderMaterial } from "three";
import { useCallback, useRef } from "react";

import { extractExpression, isExpression, isNumber } from "@repo/webgl";

import type { WebGLRootState } from "../types/render";

/**
 * Type of the result from expression evaluation
 */
export type ExpressionResult = number | boolean;

/**
 * Typesafe context for expressions
 */
export interface ExpressionContext {
  time: number;
  delta: number;
  elapsed: number;
  frame: number;
  fps: number;
  [key: string]: any;
}

/**
 * Gets a value from a nested object using a dot-notation path
 */
const getNestedValue = (obj: Record<string, any>, path: string): any => {
  return path.split(".").reduce((current: any, part: string) => {
    return current && typeof current === "object" ? current[part] : undefined;
  }, obj);
};

/**
 * Evaluates a string expression with the provided context
 */
export const evaluateExpression = (
  expression: string | number | boolean,
  context: ExpressionContext,
): ExpressionResult => {
  // If it's already a number or boolean, return it directly
  if (isNumber(expression)) {
    return expression;
  }
  if (typeof expression === "boolean") {
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
      if (value !== undefined) {
        evalExpression = evalExpression.replace(
          new RegExp(`\\b${match}\\b`, "g"),
          value.toString(),
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
): ExpressionContext => {
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

/**
 * Updates numeric uniforms with expression values
 */
const updateNumericUniforms = (
  shader: ShaderMaterial,
  expressionMap: Record<string, string | undefined>,
  context: ExpressionContext,
) => {
  Object.entries(expressionMap).forEach(([uniformName, expression]) => {
    if (!expression) return;

    const uniform = shader.uniforms[uniformName] as
      | IUniform<number>
      | undefined;
    if (!uniform) return;

    const value = evaluateExpression(expression, context);
    uniform.value = typeof value === "boolean" ? (value ? 1 : 0) : value;
  });
};

/**
 * Updates vector uniforms with expression values
 */
const updateVectorUniforms = (
  shader: ShaderMaterial,
  expressionMap: Record<string, string | undefined>,
  uniformMap: Record<string, { pathToValue: string }>,
  context: ExpressionContext,
) => {
  Object.entries(uniformMap).forEach(([expressionKey, config]) => {
    const expression = expressionMap[expressionKey];
    if (!expression) return;

    const value = evaluateExpression(expression, context);
    const numericValue = typeof value === "boolean" ? (value ? 1 : 0) : value;

    // Navigate to the target property using the path
    const parts = config.pathToValue.split(".");
    let current: Record<string, any> = shader.uniforms;

    // Follow the path to the target property
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!current || typeof current !== "object") return;
      // Make sure part is a valid key
      if (!part || !(part in current)) return;
      const next = current[part];
      if (!next || typeof next !== "object") return;
      current = next;
    }

    // Set the value at the target property
    const lastPart = parts[parts.length - 1];
    if (current.value && lastPart && typeof current.value === "object") {
      (current.value as Record<string, number>)[lastPart] = numericValue;
    }
  });
};

/**
 * Hook for expression evaluation in Three.js context
 */
export function useExpressionEvaluator() {
  // Track frame count for time context
  const frameCountRef = useRef<number>(0);

  // Increment frame count
  const incrementFrame = useCallback(() => {
    frameCountRef.current += 1;
  }, []);

  // Get the current time context based on Three.js state
  const getTimeContext = useCallback(
    (state: WebGLRootState): ExpressionContext => {
      return createTimeContext(state, frameCountRef.current);
    },
    [],
  );

  // Evaluate an expression with the current time context
  const evaluate = useCallback(
    (
      expression: string | number | undefined,
      state: WebGLRootState,
      defaultValue = 0,
    ): number => {
      if (expression === undefined) return defaultValue;

      const timeContext = getTimeContext(state);
      const result = evaluateExpression(expression, timeContext);
      return typeof result === "boolean" ? (result ? 1 : 0) : result;
    },
    [getTimeContext],
  );

  /**
   * Utility to help update shader uniforms with expression values
   */
  const updateShaderUniforms = useCallback(
    (
      state: WebGLRootState,
      shader: ShaderMaterial,
      expressionMap: Record<string, string | undefined>,
      uniformMap?: Record<string, { pathToValue: string }>,
    ) => {
      incrementFrame();
      const timeContext = getTimeContext(state);

      // Update numeric uniforms
      updateNumericUniforms(shader, expressionMap, timeContext);

      // Update vector uniforms if map is provided
      if (uniformMap) {
        updateVectorUniforms(shader, expressionMap, uniformMap, timeContext);
      }
    },
    [incrementFrame, getTimeContext],
  );

  return {
    evaluate,
    getTimeContext,
    incrementFrame,
    updateShaderUniforms,
  };
}
