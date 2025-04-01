import type { ShaderMaterial } from "three";
import { useCallback, useRef } from "react";

import { isNumber } from "@repo/webgl";

import type { WebGLRootState } from "../components/webgl/webgl-primitives";

// Helper function to check if a value is a string (expression)
export const isExpression = (value: any): value is string =>
  typeof value === "string" && value !== "";

/**
 * Evaluates a string expression with the provided context
 */
export const evaluateExpression = (
  expression: string | number,
  context: Record<string, any>,
): number => {
  // If it's already a number, return it directly
  if (isNumber(expression)) {
    return expression;
  }

  try {
    // Replace variables with their values from context
    let evalExpression = expression;
    Object.entries(context).forEach(([key, value]) => {
      evalExpression = evalExpression.replace(
        new RegExp(`\\b${key}\\b`, "g"),
        value.toString(),
      );
    });

    // Use Function constructor to safely evaluate the expression
    const func = new Function("return " + evalExpression);
    return func();
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
      return evaluateExpression(expression, timeContext);
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

      // Update simple uniforms (direct mapping)
      Object.entries(expressionMap).forEach(([uniformName, expression]) => {
        if (!expression || !shader.uniforms[uniformName]) return;

        const value = evaluateExpression(expression, timeContext);
        shader.uniforms[uniformName].value = value;
      });

      // Update complex uniforms with paths (e.g. vector components)
      if (uniformMap) {
        Object.entries(uniformMap).forEach(([expressionKey, config]) => {
          const expression = expressionMap[expressionKey];
          if (!expression) return;

          const value = evaluateExpression(expression, timeContext);

          // Navigate to the target property using the path
          const parts = config.pathToValue.split(".");
          let current = shader.uniforms;

          // Follow the path to the target property
          for (let i = 0; i < parts.length - 1; i++) {
            const part = parts[i];
            if (!current[part]) return;
            current = current[part];
          }

          // Set the value at the target property
          const lastPart = parts[parts.length - 1];
          if (current.value && lastPart) {
            current.value[lastPart] = value;
          }
        });
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
