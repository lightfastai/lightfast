# Architecture Overview: Strict Compile-Time Connection Flow

## System Overview

The strict compile-time connection flow system provides type-safe handling of node connections in React TD. It uses branded types and compile-time validation to ensure connection safety while maintaining runtime performance.

## Core Components

### 1. Type System

The type system is built on three main branded types:

```typescript
// Handle Types
export type TextureHandleId = string & { readonly __brand: "TextureHandleId" };
export type OutputHandleId = string & { readonly __brand: "OutputHandleId" };
export type HandleId = TextureHandleId | OutputHandleId;

// Expression Type
export type Expression = string & { readonly __brand: "Expression" };
```

### 2. Validation System

Multi-layered validation ensures type safety:

1. **Compile-Time Validation**

   - Branded types enforce handle format
   - TypeScript type checking for connections
   - Expression type safety

2. **Runtime Validation**
   - Zod schemas for API validation
   - Connection validation middleware
   - Expression evaluation safety

### 3. Expression Evaluation

Type-safe expression system:

```typescript
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
  [key: string]: any;
}

export type ExpressionResult = number | boolean;
```

### 4. Connection Management

Enhanced connection handling:

```typescript
export interface StrictConnection extends BaseConnection {
  sourceHandle: HandleId;
  targetHandle: HandleId;
}

export function toStrictConnection(
  connection: BaseConnection,
): StrictConnection | null;
```

## Implementation Details

### 1. Handle Creation

Handles are created using type-safe constructors:

```typescript
export function createTextureHandleId(value: string): TextureHandleId | null;
export function createOutputHandleId(value: string): OutputHandleId | null;
```

### 2. Expression Management

Expression evaluation with type safety:

```typescript
export function evaluateExpression(
  expression: Expression | number | boolean,
  context: ExpressionContext,
): ExpressionResult;
```

### 3. Uniform Updates

Type-safe uniform management:

```typescript
export interface UniformConfig {
  uniformName: string;
  pathToValue?: string;
}

function updateNumericUniforms(
  shader: ShaderMaterial,
  expressionMap: ExpressionMap,
  context: ExpressionContext,
): void;
```

## Data Flow

1. **Handle Creation**

   - Type-safe handle creation
   - Validation at creation time
   - Compile-time type checking

2. **Connection Creation**

   - Handle type validation
   - Connection compatibility check
   - Type-safe connection object

3. **Expression Evaluation**

   - Context validation
   - Type-safe evaluation
   - Error handling

4. **Uniform Updates**
   - Type-safe uniform access
   - Expression evaluation
   - Performance optimization

## Performance Considerations

1. **Type System**

   - Zero runtime overhead from types
   - Efficient validation checks
   - Minimal memory usage

2. **Expression Evaluation**

   - Optimized context access
   - Error handling overhead
   - Caching opportunities

3. **Connection Management**
   - Fast validation checks
   - Efficient type guards
   - Minimal allocations

## Error Handling

1. **Compile Time**

   - TypeScript errors
   - Type mismatch detection
   - Invalid handle detection

2. **Runtime**
   - Validation errors
   - Expression errors
   - Connection errors

## Future Extensions

1. **Type System**

   - Additional handle types
   - Enhanced type inference
   - Custom type guards

2. **Performance**

   - Expression caching
   - Validation optimization
   - Memory management

3. **Developer Experience**
   - Enhanced error messages
   - Development tools
   - Documentation

## Migration Path

1. **Code Migration**

   - Gradual type adoption
   - Feature flags
   - Backward compatibility

2. **Data Migration**
   - Safe data conversion
   - Validation checks
   - Rollback support

## Success Metrics

1. **Type Safety**

   - Compile-time errors
   - Runtime validation
   - Error prevention

2. **Performance**

   - Render performance
   - Connection speed
   - Memory usage

3. **Developer Experience**
   - Clear error messages
   - Easy debugging
   - Good documentation
