# Phase 9.5: Expression System Integration

## Overview

This phase integrates the expression system with our handle-based architecture, implementing proper type safety for expressions, complex uniform types, and shader management while maintaining clean architectural boundaries.

## Requirements

### Expression System Integration

1. **Expression Types**

   - Type-safe expression definitions
   - Support for complex uniform types (vec2, vec3, vec4)
   - Expression validation
   - Shader integration

2. **Handle Integration**

   - Expression-handle mapping
   - Type safety for expressions
   - Expression validation
   - Error handling

3. **Resource Management**
   - Expression caching
   - Shader caching
   - Memory management
   - Performance optimization

### Type Definitions

```typescript
// packages/webgl/src/types/expression.ts
export interface ExpressionValue {
  type: "float" | "vec2" | "vec3" | "vec4";
  value: number | number[];
  expression?: string;
}

export interface ExpressionConfig {
  inputs: Record<string, ExpressionValue>;
  outputs: Record<string, ExpressionValue>;
  validate: (expression: string) => ValidationResult;
}

export interface ExpressionRegistry {
  [expressionType: string]: ExpressionConfig;
}

export interface ExpressionHandle extends BaseHandle {
  type: "expression";
  expressionType: string;
  outputType: ExpressionValue["type"];
}

export interface ExpressionValidationResult extends ValidationResult {
  compiledExpression?: string;
  dependencies?: string[];
}
```

### Expression Implementation

```typescript
// packages/webgl/src/expression/expression-validation.ts
export function createExpressionValidation(
  registry: ExpressionRegistry,
): ExpressionValidation {
  return {
    validateExpression(
      expression: string,
      type: string,
    ): ExpressionValidationResult {
      const config = registry[type];
      if (!config) {
        return {
          valid: false,
          error: `Unknown expression type: ${type}`,
        };
      }

      try {
        const result = config.validate(expression);
        if (!result.valid) {
          return result;
        }

        return {
          valid: true,
          compiledExpression: result.compiledExpression,
          dependencies: result.dependencies,
        };
      } catch (error) {
        return {
          valid: false,
          error: `Expression validation failed: ${error.message}`,
        };
      }
    },

    validateExpressionHandle(handle: ExpressionHandle): ValidationResult {
      if (!handle.expressionType || !handle.outputType) {
        return {
          valid: false,
          error: "Invalid expression handle structure",
        };
      }

      const config = registry[handle.expressionType];
      if (!config) {
        return {
          valid: false,
          error: `Unknown expression type: ${handle.expressionType}`,
        };
      }

      return { valid: true };
    },
  };
}
```

### Hook Integration

```typescript
// packages/webgl/src/hooks/use-expression-evaluation.ts
export function useExpressionEvaluation(
  nodeId: string,
  expression: string,
  type: string,
) {
  const evaluationContext = useRef<EvaluationContext>({
    time: 0,
    frame: 0,
  });

  const [result, setResult] = useState<ExpressionValue | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const config = EXPRESSION_REGISTRY[type];
    if (!config) {
      setError(`Unknown expression type: ${type}`);
      return;
    }

    try {
      const validationResult = validateExpression(expression, type);
      if (!validationResult.valid) {
        setError(validationResult.error);
        return;
      }

      // Set up expression evaluation
      const cleanup = setupExpressionEvaluation(
        nodeId,
        validationResult.compiledExpression!,
        evaluationContext.current,
        (value) => setResult(value),
        (error) => setError(error),
      );

      return cleanup;
    } catch (error) {
      setError(`Expression evaluation failed: ${error.message}`);
    }
  }, [nodeId, expression, type]);

  return {
    result,
    error,
    context: evaluationContext.current,
  };
}
```

## Implementation Guidelines

1. **Type Safety**

   - Use strict TypeScript
   - Proper type guards
   - Expression validation
   - Type inference

2. **Expression Management**

   - Efficient evaluation
   - Proper caching
   - Resource cleanup
   - Error handling

3. **Performance**

   - Fast evaluation
   - Smart caching
   - Minimal allocations
   - Shader optimization

4. **Error Handling**
   - Clear messages
   - Type safety
   - Recovery options
   - Debugging support

## Success Criteria

1. **Type Safety**

   - No type errors
   - Clear boundaries
   - Expression validation
   - Documentation

2. **Expression System**

   - Proper evaluation
   - Resource cleanup
   - Error handling
   - Performance

3. **Integration**

   - Clean boundaries
   - No circular deps
   - Clear interfaces
   - Easy to use

4. **Performance**
   - Fast evaluation
   - Minimal overhead
   - Smart caching
   - Resource efficiency

## Testing Requirements

1. **Expression Tests**

   - Type validation
   - Expression evaluation
   - Error cases
   - Performance

2. **Integration Tests**

   - Handle system
   - Shader integration
   - Resource management
   - Error handling

3. **Performance Tests**
   - Evaluation speed
   - Memory usage
   - Cache efficiency
   - Resource usage

## Documentation Requirements

1. **Expression Documentation**

   - Type definitions
   - Validation rules
   - Usage examples
   - Best practices

2. **Architecture Documentation**

   - System integration
   - Expression flow
   - Error handling
   - Performance tips

3. **API Documentation**
   - Public interfaces
   - Expression syntax
   - Error codes
   - Debug tools
