# Handle Type System Design

## Overview

The Handle Type System is a core component of the Strict Compile-Time Connection Flow, providing type-level safety for node connection handles. This design shifts validation from runtime to compile-time, allowing developers to catch errors earlier in the development process.

## Branded Types Design

We use TypeScript's branded types pattern to create unique types for handle IDs that are more than just string aliases.

### TextureHandleId

```typescript
// TypeScript branded type for texture input handles
export type TextureHandleId = string & { readonly __brand: "TextureHandleId" };
```

Key characteristics:

- Structurally a string at runtime
- Distinct type at compile-time
- Carries format validation guarantees
- Cannot be assigned a regular string without validation

### OutputHandleId

```typescript
// TypeScript branded type for node output handles
export type OutputHandleId = string & { readonly __brand: "OutputHandleId" };
```

Key characteristics:

- Similar structure to TextureHandleId
- Different brand to prevent assignment
- Represents output connection points
- Format follows "output-{name}" pattern

### Union Type

```typescript
// Union type for all handle types
export type HandleId = TextureHandleId | OutputHandleId;
```

Purpose:

- Represent any valid handle ID
- Used in generic contexts where either type is acceptable
- Maintains type safety while allowing flexibility

## Constructor Functions

Constructor functions provide safe ways to create handle IDs:

```typescript
// Safe constructor for TextureHandleId
export function createTextureHandleId(value: string): TextureHandleId | null {
  if (!isValidTextureHandleId(value)) return null;
  return value as TextureHandleId;
}

// Safe constructor for OutputHandleId
export function createOutputHandleId(value: string): OutputHandleId | null {
  if (!isValidOutputHandleId(value)) return null;
  return value as OutputHandleId;
}
```

Benefits:

- Ensures validation before type casting
- Returns null for invalid values
- Provides explicit entry point for creating typed handles
- Centralizes validation logic

## Generator Functions

Generator functions create handles from other data:

```typescript
// Generate TextureHandleId from index
export function generateTextureHandleId(index: number): TextureHandleId {
  const handleId = `input-${index + 1}`;
  return handleId as TextureHandleId;
}

// Generate OutputHandleId from name
export function generateOutputHandleId(name: string): OutputHandleId | null {
  const id = `output-${name}`;
  return createOutputHandleId(id);
}
```

Benefits:

- Ensures consistent format generation
- Abstracts format knowledge from consumers
- Provides convenient utilities for common cases
- Returns properly typed values

## Type Guards

Type guards provide runtime validation with type narrowing:

```typescript
// Type guard for TextureHandleId
export function isTextureHandleId(value: unknown): value is TextureHandleId {
  return typeof value === "string" && isValidTextureHandleId(value as string);
}

// Type guard for OutputHandleId
export function isOutputHandleId(value: unknown): value is OutputHandleId {
  return typeof value === "string" && isValidOutputHandleId(value as string);
}
```

Benefits:

- Enables type narrowing in conditional blocks
- Works with TypeScript's control flow analysis
- Provides runtime safety for dynamic values
- Useful for validating external inputs

## Regular Expression Validation

Format validation is enforced via regular expressions:

```typescript
// Regular expression for texture handle validation
export const TEXTURE_HANDLE_ID_REGEX = /^input-\d+$/;

// Regular expression for output handle validation
export const OUTPUT_HANDLE_ID_REGEX = /^output-[a-z0-9-]+$/;
```

Benefits:

- Centralizes format definition
- Consistent validation across the system
- Easy to update or extend
- Clear documentation of expected formats

## Zod Schema Integration

Integration with Zod provides schema validation:

```typescript
// Zod schema for TextureHandleId
export const $TextureHandleId = z.custom<TextureHandleId>(
  (val) => typeof val === "string" && isValidTextureHandleId(val as string),
  {
    message:
      "Handle ID must be in the format 'input-N' where N is a positive integer",
  },
);

// Zod schema for OutputHandleId
export const $OutputHandleId = z.custom<OutputHandleId>(
  (val) => typeof val === "string" && isValidOutputHandleId(val as string),
  {
    message: "Output handle ID must be in the format 'output-name'",
  },
);
```

Benefits:

- Integration with database schema validation
- Detailed error messages for invalid values
- Consistent validation across client and server
- Type inference for parsed values

## Type Mapping Utilities

Utilities for working with typed handles:

```typescript
// Get index from TextureHandleId
export function getTextureHandleIndex(handleId: TextureHandleId): number {
  const match = /^input-(\d+)$/.exec(handleId);
  return parseInt(match![1], 10) - 1;
}

// Get uniform name from TextureHandleId
export function getUniformNameFromTextureHandleId(
  handleId: TextureHandleId,
): string {
  const index = getTextureHandleIndex(handleId);
  return `u_texture${index + 1}`;
}
```

Benefits:

- Type-safe operations on handles
- Consistent mapping between formats
- Encapsulation of format knowledge
- Prevention of invalid operations

## Backward Compatibility

To maintain backward compatibility:

```typescript
// Accept both string and TextureHandleId
export function backwardCompatibleFunction(
  handleId: string | TextureHandleId,
): void {
  // Convert string to TextureHandleId if needed
  const typedHandle =
    typeof handleId === "string"
      ? createTextureHandleId(handleId) || fallbackHandle
      : handleId;

  // Rest of function using typed handle
}
```

Benefits:

- Gradual migration path
- No breaking changes for existing code
- Type safety for new code
- Runtime validation for legacy inputs

## Feature Flag Support

Feature flag integration for phased rollout:

```typescript
// Feature flag usage example
const handleId = featureFlags.strictConnectionFlow
  ? generateTextureHandleId(index) // New typed approach
  : `input-${index + 1}`; // Legacy string approach
```

Benefits:

- Controlled feature rollout
- Easy rollback mechanism
- Coexistence of old and new code
- Testing in production environment

## Type Inference Example

Example showing TypeScript type inference:

```typescript
// The parameter type determines the return type
function processHandle<T extends HandleId>(
  handle: T,
): T extends TextureHandleId
  ? { type: "input"; index: number }
  : { type: "output"; name: string } {
  if (isTextureHandleId(handle)) {
    return {
      type: "input",
      index: getTextureHandleIndex(handle),
    } as any;
  } else {
    return {
      type: "output",
      name: handle.replace("output-", ""),
    } as any;
  }
}

// TypeScript infers the correct return type
const result1 = processHandle(generateTextureHandleId(0));
// result1 has type { type: 'input', index: number }

const result2 = processHandle(createOutputHandleId("output-main")!);
// result2 has type { type: 'output', name: string }
```

This demonstrates how our type system enables sophisticated type inferencing and compile-time safety.
