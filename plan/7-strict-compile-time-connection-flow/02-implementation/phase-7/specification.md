# Phase 7: Connection Validation and Middleware

## Overview

This phase implements a comprehensive connection validation system and middleware that enforces type safety and handle compatibility at both compile-time and runtime.

## Requirements

### Validation System

1. **Type-Safe Validation**

   - Compile-time type checking
   - Runtime validation
   - Handle compatibility
   - Clear error messages

2. **Connection Rules**

   - Source/target compatibility
   - Handle type validation
   - Texture type validation
   - Custom validation rules

3. **Error Handling**
   - Descriptive error messages
   - Type-safe error types
   - Error categorization
   - Error recovery

### Type Definitions

```typescript
// packages/webgl/src/types/validation.ts
export interface ValidationResult {
  valid: boolean;
  error?: string;
  details?: {
    code: string;
    message: string;
    context?: Record<string, unknown>;
  };
}

export interface ConnectionValidation {
  validateConnection: (connection: Connection) => ValidationResult;
  validateHandle: (handle: BaseHandle) => ValidationResult;
  validateHandleCompatibility: (
    source: OutputHandle,
    target: TextureHandle,
  ) => ValidationResult;
}

export type ValidationMiddleware = (
  next: (connection: Connection) => boolean,
) => (connection: Connection) => boolean;
```

### Validation Implementation

```typescript
// packages/webgl/src/validation/connection-validation.ts
export function createConnectionValidation(
  registry: TextureRegistry,
): ConnectionValidation {
  return {
    validateConnection(connection: Connection): ValidationResult {
      // Validate basic connection structure
      if (!connection.source || !connection.target) {
        return {
          valid: false,
          error: "Invalid connection structure",
          details: {
            code: "INVALID_STRUCTURE",
            message: "Connection must have source and target",
          },
        };
      }

      // Validate handles
      const sourceResult = this.validateHandle(connection.sourceHandle);
      if (!sourceResult.valid) {
        return sourceResult;
      }

      const targetResult = this.validateHandle(connection.targetHandle);
      if (!targetResult.valid) {
        return targetResult;
      }

      // Validate handle compatibility
      return this.validateHandleCompatibility(
        connection.sourceHandle as OutputHandle,
        connection.targetHandle as TextureHandle,
      );
    },

    validateHandle(handle: BaseHandle): ValidationResult {
      if (!handle.id || !handle.uniformName) {
        return {
          valid: false,
          error: "Invalid handle structure",
          details: {
            code: "INVALID_HANDLE",
            message: "Handle must have id and uniformName",
          },
        };
      }

      return { valid: true };
    },

    validateHandleCompatibility(
      source: OutputHandle,
      target: TextureHandle,
    ): ValidationResult {
      // Check handle types
      if (source.type !== "output" || target.type !== "texture") {
        return {
          valid: false,
          error: "Incompatible handle types",
          details: {
            code: "INCOMPATIBLE_TYPES",
            message: "Source must be output and target must be texture",
          },
        };
      }

      return { valid: true };
    },
  };
}
```

### Middleware Implementation

```typescript
// packages/webgl/src/middleware/validation-middleware.ts
export function createValidationMiddleware(
  validation: ConnectionValidation,
  onError?: (error: ValidationResult) => void,
): ValidationMiddleware {
  return (next) => (connection) => {
    const result = validation.validateConnection(connection);

    if (!result.valid) {
      if (onError) {
        onError(result);
      }
      return false;
    }

    return next(connection);
  };
}

// Usage example
const validationMiddleware = createValidationMiddleware(
  createConnectionValidation(TEXTURE_REGISTRY),
  (error) => {
    console.error("Connection validation failed:", error);
    toast({
      title: "Invalid Connection",
      description: error.error,
      variant: "destructive",
    });
  },
);
```

## Implementation Guidelines

1. **Type Safety**

   - Use strict TypeScript
   - Proper type guards
   - Clear type boundaries
   - Type inference

2. **Validation**

   - Clear rules
   - Fast validation
   - Proper caching
   - Error handling

3. **Middleware**

   - Composable design
   - Clear boundaries
   - Error handling
   - Performance

4. **Error Handling**
   - Clear messages
   - Type safety
   - Recovery options
   - Logging

## Success Criteria

1. **Type Safety**

   - No type errors
   - Clear boundaries
   - Type inference
   - Documentation

2. **Validation**

   - All rules enforced
   - Fast validation
   - Clear errors
   - Recovery

3. **Middleware**

   - Composable
   - Performant
   - Error handling
   - Clean API

4. **Integration**
   - Clean boundaries
   - No circular deps
   - Clear interfaces
   - Performance

## Testing Requirements

1. **Type Tests**

   - Type inference
   - Type guards
   - Edge cases
   - Boundaries

2. **Validation Tests**

   - Rule coverage
   - Error cases
   - Performance
   - Integration

3. **Middleware Tests**
   - Composition
   - Error handling
   - Performance
   - Integration

## Documentation Requirements

1. **Type Documentation**

   - Interfaces
   - Type guards
   - Usage examples
   - Best practices

2. **Validation Documentation**

   - Rules
   - Error codes
   - Examples
   - Recovery

3. **Middleware Documentation**
   - API
   - Composition
   - Examples
   - Best practices
