# Phase 4: Expression System Refactor

## Overview

Refactor the expression system to be more functional and type-safe, integrating with the texture uniform system while maintaining strict compile-time validation.

## Implementation

### 1. Expression Types

```typescript
// packages/webgl/src/types/expression.ts
import type { WebGLRootState } from "./state";

/**
 * Branded type for expressions
 */
export type Expression = string & { readonly __brand: "Expression" };

/**
 * Type-safe result types
 */
export type ExpressionResult = number | boolean;

/**
 * Time-based context for expression evaluation
 */
export interface ExpressionContext {
  readonly time: number;
  readonly delta: number;
  readonly me: {
    readonly time: {
      readonly now: number;
      readonly delta: number;
      readonly elapsed: number;
      readonly frame: number;
      readonly fps: number;
      readonly seconds: number;
      readonly minutes: number;
      readonly hours: number;
    };
  };
  readonly [key: string]: any;
}

/**
 * Configuration for uniform updates
 */
export interface UniformConfig {
  readonly uniformName: string;
  readonly pathToValue?: string;
}

/**
 * Type-safe expression mapping
 */
export type ExpressionMap = Readonly<Record<string, Expression | undefined>>;

/**
 * Type guard for expressions
 */
export function isExpression(value: unknown): value is Expression {
  return typeof value === "string" && value.startsWith("$");
}

/**
 * Safe expression constructor
 */
export function createExpression(value: string): Expression | null {
  if (!value.startsWith("$")) return null;
  return value as Expression;
}

/**
 * Type guard for expression results
 */
export function isExpressionResult(value: unknown): value is ExpressionResult {
  return typeof value === "number" || typeof value === "boolean";
}
```

### 2. Expression Evaluation

```typescript
// packages/webgl/src/utils/expression-utils.ts
import type {
  Expression,
  ExpressionContext,
  ExpressionResult,
} from "../types/expression";

/**
 * Extract expression content from prefixed format
 */
export function extractExpression(expression: Expression): string {
  return expression.slice(1);
}

/**
 * Get a value from a nested object using dot notation
 */
export function getNestedValue(
  obj: Readonly<Record<string, any>>,
  path: string,
): any {
  if (!path) return undefined;

  return path.split(".").reduce((current: any, part: string) => {
    if (current === undefined || current === null) return undefined;
    if (typeof current !== "object") return undefined;
    return current[part];
  }, obj);
}

/**
 * Create time context for expression evaluation
 */
export function createTimeContext(
  state: WebGLRootState,
  frameCount: number,
): ExpressionContext {
  return {
    time: state.clock.getElapsedTime(),
    delta: state.clock.getDelta(),
    me: {
      time: {
        now: Date.now(),
        delta: state.clock.getDelta(),
        elapsed: state.clock.getElapsedTime(),
        frame: frameCount,
        fps: 1 / state.clock.getDelta(),
        seconds: Math.floor(state.clock.getElapsedTime()),
        minutes: Math.floor(state.clock.getElapsedTime() / 60),
        hours: Math.floor(state.clock.getElapsedTime() / 3600),
      },
    },
  };
}

/**
 * Evaluate an expression with provided context
 */
export function evaluateExpression(
  expression: Expression | number | boolean,
  context: ExpressionContext,
): ExpressionResult {
  // Handle non-string expressions
  if (typeof expression === "number" || typeof expression === "boolean") {
    return expression;
  }

  try {
    const extractedExpression = extractExpression(expression);
    let evalExpression = extractedExpression;

    // Find and replace variables
    const variableRegex = /\b[a-zA-Z_][a-zA-Z0-9_.]*\b/g;
    const matches = evalExpression.match(variableRegex) || [];

    matches.forEach((match) => {
      const value = getNestedValue(context, match);
      if (value !== undefined) {
        evalExpression = evalExpression.replace(
          new RegExp(`\\b${match}\\b`, "g"),
          typeof value === "string" ? `"${value}"` : value.toString(),
        );
      }
    });

    // Safely evaluate the expression
    const func = new Function("return " + evalExpression);
    const result = func();

    return typeof result === "boolean" ? result : Number(result);
  } catch (error) {
    console.error(
      "Error evaluating expression:",
      error,
      "in expression:",
      expression,
    );
    return typeof expression === "string" && expression.includes("time")
      ? context.time * 0.1
      : 0;
  }
}
```

### 3. Uniform Updates

```typescript
// packages/webgl/src/utils/uniform-updates.ts
import type { IUniform, ShaderMaterial } from "three";

import type {
  Expression,
  ExpressionContext,
  ExpressionMap,
  UniformConfig,
} from "../types/expression";
import { evaluateExpression } from "./expression-utils";

/**
 * Update numeric uniforms with expression values
 */
export function updateNumericUniforms(
  shader: ShaderMaterial,
  expressionMap: ExpressionMap,
  context: ExpressionContext,
): void {
  Object.entries(expressionMap).forEach(([uniformName, expression]) => {
    if (!expression) return;

    const uniform = shader.uniforms[uniformName] as
      | IUniform<number>
      | undefined;
    if (!uniform) return;

    const result = evaluateExpression(expression, context);
    uniform.value = typeof result === "boolean" ? (result ? 1 : 0) : result;
  });
}

/**
 * Update vector uniforms with expression values
 */
export function updateVectorUniforms(
  shader: ShaderMaterial,
  expressionMap: ExpressionMap,
  uniformConfigs: Readonly<Record<string, UniformConfig>>,
  context: ExpressionContext,
): void {
  Object.entries(uniformConfigs).forEach(([expressionKey, config]) => {
    const expression = expressionMap[expressionKey];
    if (!expression) return;

    const result = evaluateExpression(expression, context);
    const value = typeof result === "boolean" ? (result ? 1 : 0) : result;

    if (!config.pathToValue) {
      const uniform = shader.uniforms[config.uniformName] as
        | IUniform<number>
        | undefined;
      if (uniform) {
        uniform.value = value;
      }
      return;
    }

    // Update nested uniform value
    updateNestedUniformValue(
      shader,
      config.uniformName,
      config.pathToValue,
      value,
    );
  });
}

/**
 * Update a nested uniform value
 */
function updateNestedUniformValue(
  shader: ShaderMaterial,
  uniformName: string,
  path: string,
  value: number,
): void {
  const parts = path.split(".");
  if (parts.length === 0) return;

  let current: Record<string, any> = shader.uniforms;

  // Get the uniform
  if (!current[uniformName]) return;
  current = current[uniformName];

  // Navigate to the value property
  if (!current.value || typeof current.value !== "object") return;
  current = current.value;

  // Set the property at the path
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (!current[part] || typeof current[part] !== "object") return;
    current = current[part];
  }

  const lastPart = parts[parts.length - 1];
  if (lastPart) {
    current[lastPart] = value;
  }
}
```

### 4. Expression Hook

```typescript
// packages/webgl/src/hooks/use-expression-evaluator.ts
import type { ShaderMaterial } from "three";
import { useCallback, useRef } from "react";

import type {
  Expression,
  ExpressionMap,
  UniformConfig,
} from "../types/expression";
import type { WebGLRootState } from "../types/state";
import {
  createTimeContext,
  evaluateExpression,
} from "../utils/expression-utils";
import {
  updateNumericUniforms,
  updateVectorUniforms,
} from "../utils/uniform-updates";

export function useExpressionEvaluator() {
  const frameCountRef = useRef<number>(0);

  const incrementFrame = useCallback(() => {
    frameCountRef.current += 1;
  }, []);

  const getTimeContext = useCallback(
    (state: WebGLRootState) => createTimeContext(state, frameCountRef.current),
    [],
  );

  const evaluate = useCallback(
    (
      expression: Expression | number | undefined,
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

  const updateShaderUniforms = useCallback(
    (
      state: WebGLRootState,
      shader: ShaderMaterial,
      expressionMap: ExpressionMap,
      uniformConfigs?: Readonly<Record<string, UniformConfig>>,
    ): void => {
      incrementFrame();
      const timeContext = getTimeContext(state);

      updateNumericUniforms(shader, expressionMap, timeContext);

      if (uniformConfigs) {
        updateVectorUniforms(
          shader,
          expressionMap,
          uniformConfigs,
          timeContext,
        );
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
```

## Migration Steps

1. **Type System Updates**

   - Implement branded types for expressions
   - Add readonly modifiers to types
   - Create type guards and constructors

2. **Expression Evaluation**

   - Implement pure evaluation functions
   - Add proper error handling
   - Support time-based expressions

3. **Uniform Updates**

   - Create pure update functions
   - Support nested uniform paths
   - Handle vector uniforms

4. **Hook Integration**
   - Update hook to use pure functions
   - Maintain frame counter state
   - Provide type-safe interface

## Validation

1. **Type Safety**

   - Branded types for expressions
   - Readonly interfaces
   - Pure function signatures

2. **Performance**

   - Efficient expression parsing
   - Optimized uniform updates
   - Minimal state changes

3. **Error Handling**
   - Safe expression evaluation
   - Fallback values
   - Clear error messages
