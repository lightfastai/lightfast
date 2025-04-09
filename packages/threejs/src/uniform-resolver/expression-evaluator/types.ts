"use client";

import type { ValueType } from "@repo/webgl";

/**
 * Type of the result from expression evaluation
 */
export type ExpressionResult = number | boolean;

/**
 * Typesafe context for expressions
 */
export interface ExpressionTimeContext {
  time: number;
  delta: number;
  elapsed: number;
  frame: number;
  fps: number;
  [key: string]: unknown;
}

/**
 * Interface for uniform with possible expressions
 */
export interface UniformWithExpressions<T> {
  uniformName: string;
  value: T;
  type: ValueType;
}
