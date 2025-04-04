# Handle Type System Design

## Overview

The handle type system provides compile-time type safety for node connections through branded types and comprehensive validation. It supports both texture input handles and node output handles, along with expression-based dynamic values.

## Type Definitions

### Core Types

```typescript
// Handle Types
export type TextureHandleId = string & { readonly __brand: "TextureHandleId" };
export type OutputHandleId = string & { readonly __brand: "OutputHandleId" };
export type HandleId = TextureHandleId | OutputHandleId;

// Expression Types
export type Expression = string & { readonly __brand: "Expression" };
export type ExpressionResult = number | boolean;

// Context Types
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
```

### Validation Types

```typescript
// Zod Schemas
export const $TextureHandleId = z.custom<TextureHandleId>(
  (val) => typeof val === "string" && isValidTextureHandleId(val as string),
  {
    message: "Invalid texture handle ID format",
  },
);

export const $OutputHandleId = z.custom<OutputHandleId>(
  (val) => typeof val === "string" && isValidOutputHandleId(val as string),
  {
    message: "Invalid output handle ID format",
  },
);

export const $Expression = z.custom<Expression>(
  (val) => typeof val === "string" && val.startsWith("$"),
  {
    message: "Expression must be a string that starts with $",
  },
);
```

## Type Guards

```typescript
// Handle Type Guards
export function isTextureHandleId(value: unknown): value is TextureHandleId {
  return typeof value === "string" && TEXTURE_HANDLE_ID_REGEX.test(value);
}

export function isOutputHandleId(value: unknown): value is OutputHandleId {
  return typeof value === "string" && OUTPUT_HANDLE_ID_REGEX.test(value);
}

// Expression Type Guards
export function isExpression(value: unknown): value is Expression {
  return typeof value === "string" && value.startsWith("$");
}

export function isExpressionResult(value: unknown): value is ExpressionResult {
  return typeof value === "number" || typeof value === "boolean";
}
```

## Constructor Functions

```typescript
// Handle Constructors
export function createTextureHandleId(value: string): TextureHandleId | null {
  return isValidTextureHandleId(value) ? (value as TextureHandleId) : null;
}

export function createOutputHandleId(value: string): OutputHandleId | null {
  return isValidOutputHandleId(value) ? (value as OutputHandleId) : null;
}

// Expression Constructor
export function createExpression(value: string): Expression | null {
  return value.startsWith("$") ? (value as Expression) : null;
}
```

## Utility Functions

```typescript
// Handle Utilities
export function generateTextureHandleId(index: number): TextureHandleId {
  return `input-${index}` as TextureHandleId;
}

export function generateOutputHandleId(name: string): OutputHandleId {
  return `output-${name}` as OutputHandleId;
}

// Expression Utilities
export function extractExpression(expression: Expression): string {
  return expression.slice(1);
}

export function evaluateExpression(
  expression: Expression | number | boolean,
  context: ExpressionContext,
): ExpressionResult {
  // Implementation details...
}
```

## Component Integration

### Handle Props

```typescript
export interface NodeHandleProps {
  id: HandleId;
  type: "input" | "output";
  // Other props...
}

export interface TextureNodeProps {
  inputHandles: TextureHandleId[];
  outputHandle: OutputHandleId;
  // Other props...
}
```

### Connection Types

```typescript
export interface StrictConnection extends BaseConnection {
  sourceHandle: HandleId;
  targetHandle: HandleId;
}

export function toStrictConnection(
  connection: BaseConnection,
): StrictConnection | null {
  // Implementation details...
}
```

## Expression System Integration

### Uniform Configuration

```typescript
export interface UniformConfig {
  uniformName: string;
  pathToValue?: string;
}

export type ExpressionMap = Record<string, Expression | undefined>;

export interface UniformUpdate {
  shader: ShaderMaterial;
  expressions: ExpressionMap;
  context: ExpressionContext;
}
```

### Update Functions

```typescript
export function updateNumericUniforms(
  shader: ShaderMaterial,
  expressionMap: ExpressionMap,
  context: ExpressionContext,
): void {
  // Implementation details...
}

export function updateVectorUniforms(
  shader: ShaderMaterial,
  expressionMap: ExpressionMap,
  context: ExpressionContext,
): void {
  // Implementation details...
}
```

## Error Handling

### Compile-Time Errors

- Invalid handle type assignments
- Incorrect connection types
- Expression type mismatches

### Runtime Validation

- Handle format validation
- Connection compatibility
- Expression evaluation errors

## Performance Considerations

1. **Type System**

   - Zero runtime overhead
   - Efficient validation
   - Minimal allocations

2. **Expression Evaluation**

   - Optimized context access
   - Caching opportunities
   - Error recovery

3. **Memory Management**
   - Reuse of handle objects
   - Expression result caching
   - Context optimization

## Future Extensions

1. **Type System**

   - Additional handle types
   - Enhanced type inference
   - Custom validation rules

2. **Expression System**

   - More expression types
   - Advanced validation
   - Performance optimizations

3. **Developer Tools**
   - Type checking tools
   - Debugging utilities
   - Documentation generation
