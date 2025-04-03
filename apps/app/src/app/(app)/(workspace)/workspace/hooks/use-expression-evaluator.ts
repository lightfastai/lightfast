import type { IUniform, ShaderMaterial } from "three";
import { useCallback, useRef } from "react";

import { extractExpression, isNumber } from "@repo/webgl";

import type { WebGLRootState } from "../webgl";

// Helper function to check if a value is a string (expression)
export const isExpression = (value: any): value is string =>
  typeof value === "string" && value !== "";

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
  context: Record<string, any>,
): number | boolean => {
  // If it's already a number or boolean, return it directly
  if (isNumber(expression)) {
    return expression;
  }
  if (typeof expression === "boolean") {
    return expression;
  }

  try {
    // Extract the actual expression from the prefixed format
    const extractedExpression = extractExpression(expression);

    // Replace variables with their values from context
    let evalExpression = extractedExpression;

    // First, find all potential variable paths in the expression
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

    // If the result is a boolean, return it as is
    if (typeof result === "boolean") {
      return result;
    }

    // Otherwise return as number
    return Number(result);
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
 * Updates numeric uniforms with expression values
 */
const updateNumericUniforms = (
  shader: ShaderMaterial,
  expressionMap: Record<string, string | undefined>,
  timeContext: Record<string, any>,
) => {
  Object.entries(expressionMap).forEach(([uniformName, expression]) => {
    if (!expression) return;

    const uniform = shader.uniforms[uniformName] as
      | IUniform<number>
      | undefined;
    if (!uniform) return;

    const value = evaluateExpression(expression, timeContext);
    uniform.value = value;
  });
};

/**
 * Updates vector uniforms with expression values
 */
const updateVectorUniforms = (
  shader: ShaderMaterial,
  expressionMap: Record<string, string | undefined>,
  uniformMap: Record<string, { pathToValue: string }>,
  timeContext: Record<string, any>,
) => {
  Object.entries(uniformMap).forEach(([expressionKey, config]) => {
    const expression = expressionMap[expressionKey];
    if (!expression) return;

    const value = evaluateExpression(expression, timeContext);

    // Navigate to the target property using the path
    const parts = config.pathToValue.split(".");
    let current: Record<string, any> = shader.uniforms;

    // Follow the path to the target property
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!current || typeof current !== "object") return;
      const next = current[part];
      if (!next || typeof next !== "object") return;
      current = next;
    }

    // Set the value at the target property
    const lastPart = parts[parts.length - 1];
    if (current.value && lastPart && typeof current.value === "object") {
      (current.value as Record<string, number>)[lastPart] = Number(value);
    }
  });
};

/**
 * Creates a time context object with current time values
 */
export const createTimeContext = (
  state: WebGLRootState,
  frameCount = 0,
): Record<string, any> => {
  const elapsedTime = state.clock.elapsedTime;
  const deltaTime = state.clock.getDelta();
  const fps = state.frameloop === "always" ? 60 : 0; // Basic FPS estimate

  // Get current time
  const now = new Date();

  return {
    time: elapsedTime,
    delta: deltaTime,

    me: {
      time: {
        now: elapsedTime,
        delta: deltaTime,
        elapsed: elapsedTime,

        frame: frameCount,
        fps: fps,

        seconds: now.getSeconds() + now.getMilliseconds() / 1000,
        minutes: now.getMinutes(),
        hours: now.getHours(),
      },
    },
  };
};

/**
 * Hook to handle expression evaluation for any texture type
 */
export function useExpressionEvaluator() {
  // Track frame count for time context
  const frameCountRef = useRef<number>(0);

  // Increment frame count
  const incrementFrame = useCallback(() => {
    frameCountRef.current += 1;
  }, []);

  // Get the current time context
  const getTimeContext = useCallback((state: WebGLRootState) => {
    return createTimeContext(state, frameCountRef.current);
  }, []);

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
      return typeof result === "boolean" ? 0 : result;
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
