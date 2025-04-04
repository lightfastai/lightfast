# Phase 10: Expression Evaluator Type Safety - Specification

## Overview

This phase enhances the expression evaluator with proper type safety, fixing existing type errors, and integrating it with the new handle type system and schema structure. The expression evaluator is critical for dynamic texture behavior, and stronger typing will prevent runtime errors.

## Requirements

1. Create proper type definitions for expressions and their evaluation results
2. Fix existing type errors in the expression evaluator
3. Integrate with the new handle type system introduced in previous phases
4. Ensure compatibility with the updated schema structure
5. Implement branded types for expressions similar to handle IDs

## Technical Design

### Expression Type Definitions

```typescript
// Branded type for expression strings
export type Expression = string & { readonly __brand: "Expression" };

// Result types for expression evaluation
export type ExpressionResult = number | boolean;

// Expression context type with proper nesting
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

// Type-safe uniform update configuration
export interface UniformConfig {
  uniformName: string;
  pathToValue?: string;
}

// Expression map with proper types
export type ExpressionMap = Record<string, Expression | undefined>;
```

### Type Guards and Constructors

```typescript
/**
 * Type guard to check if a value is an Expression
 */
export function isExpression(value: unknown): value is Expression {
  return typeof value === "string" && value.startsWith("$");
}

/**
 * Safe constructor for Expression type
 */
export function createExpression(value: string): Expression | null {
  // Validate expression format
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

### Updated Expression Evaluator Hook

```typescript
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

  // Get the current time context with proper typing
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

### Fixed Evaluation Function

```typescript
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
```

### Updated Utility Functions

```typescript
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
```

## Dependencies

- Phase 1: Enhanced Handle Types - For branded type pattern
- Phase 6: WebGL Registry - For WebGL integration
- Phase 8: TextureUniform Simplification - For updated texture uniform types

## Impact Analysis

| Component                     | Changes Required                                               |
| ----------------------------- | -------------------------------------------------------------- |
| `use-expression-evaluator.ts` | Update with enhanced type safety                               |
| `webgl/types`                 | Add proper WebGLRootState type export                          |
| Shader components             | Update usage of expression evaluator with new type definitions |

## Acceptance Criteria

1. ✅ Expression type is a branded type that provides compile-time validation
2. ✅ Type errors in the expression evaluator are fixed
3. ✅ Boolean expression results are properly handled in numeric contexts
4. ✅ Expression evaluator integrates with the new handle type system
5. ✅ Uniform update utilities have proper type safety
6. ✅ Tests validate the expression evaluator behavior
