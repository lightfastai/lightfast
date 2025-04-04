# Phase 10: Expression Evaluator Type Safety - Implementation

## File Changes

### Create Expression Types

First, create a new file for expression types:

```typescript
// packages/webgl/src/types/expression.ts
import { z } from "zod";

/**
 * Branded type for expressions
 */
export type Expression = string & { readonly __brand: "Expression" };

/**
 * Result types for expression evaluation
 */
export type ExpressionResult = number | boolean;

/**
 * Expression context type with proper nesting
 */
export interface ExpressionContext {
  time: number;
  delta: number;
  me: {
    time: {
      now: number;
      delta: number;
      elapsed: number;
      frame: number;
      fps: number;
      seconds: number;
      minutes: number;
      hours: number;
    };
  };
  [key: string]: any; // Allow for extension
}

/**
 * Type-safe uniform update configuration
 */
export interface UniformConfig {
  uniformName: string;
  pathToValue?: string;
}

/**
 * Map of uniform names to expressions
 */
export type ExpressionMap = Record<string, Expression | undefined>;

/**
 * Check if a value is an expression string
 */
export function isExpression(value: unknown): value is Expression {
  return typeof value === "string" && value.startsWith("$");
}

/**
 * Create a strongly typed Expression from a string
 */
export function createExpression(value: string): Expression | null {
  if (!value.startsWith("$")) return null;
  return value as Expression;
}

/**
 * Check if a value is a valid expression result
 */
export function isExpressionResult(value: unknown): value is ExpressionResult {
  return typeof value === "number" || typeof value === "boolean";
}

/**
 * Extract the actual expression code from an expression string
 * Example: "$time * 0.5" -> "time * 0.5"
 */
export function extractExpression(expression: Expression | string): string {
  if (typeof expression !== "string") return "";

  // If it doesn't start with $, just return the string
  if (!expression.startsWith("$")) return expression;

  // Remove the $ prefix
  return expression.slice(1);
}

/**
 * Zod schema for Expression type
 */
export const $Expression = z.custom<Expression>(
  (val) => typeof val === "string" && val.startsWith("$"),
  {
    message: "Expression must be a string that starts with $",
  },
);

/**
 * Zod schema for ExpressionResult
 */
export const $ExpressionResult = z.union([z.number(), z.boolean()]);
```

### Update WebGL Root State

Ensure the WebGLRootState type is properly exported:

```typescript
// packages/webgl/src/types/root-state.ts
import { RootState } from "@react-three/fiber";

// packages/webgl/src/types/index.ts
export type { WebGLRootState } from "./root-state";

/**
 * Extended root state with our additional properties
 */
export interface WebGLRootState extends RootState {
  // Add any additional properties used in our expressions
  frameloop: "always" | "demand" | "never";
}
```

### Update Expression Evaluator

```typescript
// apps/app/src/app/(app)/(workspace)/workspace/hooks/use-expression-evaluator.ts
import type { IUniform, ShaderMaterial } from "three";
import { useCallback, useRef } from "react";

import type { WebGLRootState } from "@repo/webgl/types";
import { isNumber } from "@repo/webgl";
import {
  createExpression,
  Expression,
  ExpressionContext,
  ExpressionMap,
  ExpressionResult,
  extractExpression,
  isExpression as isExpressionType,
  UniformConfig,
} from "@repo/webgl/types/expression";

// Helper function to check if a value is a string expression (updated)
export const isExpression = (value: unknown): value is Expression => {
  return isExpressionType(value);
};

/**
 * Gets a value from a nested object using a dot-notation path, with type safety
 */
const getNestedValue = (obj: Record<string, any>, path: string): any => {
  if (!path) return undefined;

  return path.split(".").reduce((current: any, part: string) => {
    if (current === undefined || current === null) return undefined;
    if (typeof current !== "object") return undefined;
    return current[part];
  }, obj);
};

/**
 * Evaluates a string expression with the provided context, with proper typing
 */
export const evaluateExpression = (
  expression: Expression | number | boolean,
  context: ExpressionContext,
): ExpressionResult => {
  // If it's already a number or boolean, return it directly
  if (typeof expression === "number" || typeof expression === "boolean") {
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
          typeof value === "string" ? `"${value}"` : value.toString(),
        );
      }
    });

    // Use Function constructor to safely evaluate the expression
    const func = new Function("return " + evalExpression);
    const result = func();

    // If the result is a boolean, return it
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
    return isExpressionType(expression) && expression.includes("time")
      ? context.time * 0.1
      : 0;
  }
};

/**
 * Updates numeric uniforms with expression values
 */
const updateNumericUniforms = (
  shader: ShaderMaterial,
  expressionMap: ExpressionMap,
  context: ExpressionContext,
) => {
  Object.entries(expressionMap).forEach(([uniformName, expression]) => {
    if (!expression) return;

    const uniform = shader.uniforms[uniformName] as
      | IUniform<number>
      | undefined;
    if (!uniform) return;

    const result = evaluateExpression(expression, context);
    // Convert boolean results to 0 or 1
    uniform.value = typeof result === "boolean" ? (result ? 1 : 0) : result;
  });
};

/**
 * Updates vector uniforms with expression values
 */
const updateVectorUniforms = (
  shader: ShaderMaterial,
  expressionMap: ExpressionMap,
  uniformConfigs: Record<string, UniformConfig>,
  context: ExpressionContext,
) => {
  Object.entries(uniformConfigs).forEach(([expressionKey, config]) => {
    const expression = expressionMap[expressionKey];
    if (!expression) return;

    const result = evaluateExpression(expression, context);
    const value = typeof result === "boolean" ? (result ? 1 : 0) : result;

    // If no path is specified, use the uniform directly
    if (!config.pathToValue) {
      const uniform = shader.uniforms[config.uniformName] as
        | IUniform<number>
        | undefined;
      if (uniform) {
        uniform.value = value;
      }
      return;
    }

    // Otherwise, navigate to the target property using the path
    const parts = config.pathToValue.split(".");
    if (parts.length === 0) return;

    let current: Record<string, any> = shader.uniforms;
    const uniformName = config.uniformName;

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
  });
};

/**
 * Creates a time context object with current time values
 */
export const createTimeContext = (
  state: WebGLRootState,
  frameCount = 0,
): ExpressionContext => {
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
 * Hook to handle expression evaluation with proper type safety
 */
export function useExpressionEvaluator() {
  // Track frame count for time context
  const frameCountRef = useRef<number>(0);

  // Increment frame count
  const incrementFrame = useCallback(() => {
    frameCountRef.current += 1;
  }, []);

  // Get the current time context
  const getTimeContext = useCallback(
    (state: WebGLRootState): ExpressionContext => {
      return createTimeContext(state, frameCountRef.current);
    },
    [],
  );

  // Evaluate an expression with the current time context
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

  /**
   * Utility to help update shader uniforms with expression values
   */
  const updateShaderUniforms = useCallback(
    (
      state: WebGLRootState,
      shader: ShaderMaterial,
      expressionMap: ExpressionMap,
      uniformConfigs?: Record<string, UniformConfig>,
    ) => {
      incrementFrame();
      const timeContext = getTimeContext(state);

      // Update numeric uniforms
      updateNumericUniforms(shader, expressionMap, timeContext);

      // Update vector uniforms if map is provided
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

### Update Texture Shaders

Update the texture shaders to use the new expression types:

```typescript
// Example shader update (packages/webgl/src/shaders/noise.ts)
import {
  createExpression,
  Expression,
  ExpressionMap,
} from "../types/expression";
import { createShader } from "./create-shader";

interface NoiseUniforms {
  u_scale: number | Expression;
  u_time: number | Expression;
  u_seed: number | Expression;
}

export function createNoiseShader(uniforms: Partial<NoiseUniforms> = {}) {
  // Convert string expressions to Expression type
  const processedUniforms: Record<string, number | Expression> = {};

  // Process each uniform to ensure proper typing
  Object.entries(uniforms).forEach(([key, value]) => {
    if (typeof value === "string") {
      const expr = createExpression(value);
      if (expr) {
        processedUniforms[key] = expr;
      }
    } else {
      processedUniforms[key] = value;
    }
  });

  // Create expression map for the shader
  const expressionMap: ExpressionMap = {};
  Object.entries(processedUniforms).forEach(([key, value]) => {
    if (typeof value === "object" && value !== null) {
      expressionMap[key] = value as Expression;
    }
  });

  // Rest of the shader implementation...
}
```
