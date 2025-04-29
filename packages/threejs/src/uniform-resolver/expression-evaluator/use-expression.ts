"use client";

import { useCallback, useRef } from "react";

import { isBoolean } from "@repo/webgl";

import type { WebGLRootState } from "../../types/render";
import type { ExpressionTimeContext } from "./types";
import { createTimeContext, evaluateExpression } from "./utils";

/**
 * Type definition for the use-expression hook return value
 */
interface UseExpressionReturn {
  /**
   * Evaluates an expression with the current time context
   */
  evaluate: (
    expression: string | number | undefined,
    state: WebGLRootState,
    defaultValue?: number,
  ) => number;

  /**
   * Gets the current time context based on Three.js state
   */
  getTimeContext: (state: WebGLRootState) => ExpressionTimeContext;

  /**
   * Increments the frame counter for animations
   */
  incrementFrame: () => void;
}

/**
 * Hook for expression evaluation
 * Provides core functionality to evaluate expressions based on time context
 */
export function useExpression(): UseExpressionReturn {
  // Track frame count for time context
  const frameCountRef = useRef<number>(0);

  // Get the current time context based on Three.js state
  const getTimeContext = useCallback(
    (state: WebGLRootState): ExpressionTimeContext => {
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
      return isBoolean(result) ? (result ? 1 : 0) : result;
    },
    [getTimeContext],
  );

  // Increment frame counter
  const incrementFrame = useCallback(() => {
    frameCountRef.current += 1;
  }, []);

  return {
    evaluate,
    getTimeContext,
    incrementFrame,
  };
}
