# Phase 1: Enhanced Handle Types - Specification

## Overview

This phase implements branded TypeScript types for handle IDs to provide compile-time type safety, replacing the current string-based approach that only offers runtime validation.

## Requirements

1. Create branded types for `TextureHandleId` that ensures type safety beyond simple string validation
2. Implement safe constructor functions that validate handles during creation
3. Provide type guard functions for runtime validation
4. Maintain backward compatibility with existing code
5. Support for both input and output handles

## Technical Design

### TextureHandleId Type

```typescript
// TypeScript branded type for handles
export type TextureHandleId = string & { readonly __brand: "TextureHandleId" };

// Regular expression for handle validation (unchanged)
export const TEXTURE_HANDLE_ID_REGEX = /^input-\d+$/;

// Safe constructor function
export function createTextureHandleId(value: string): TextureHandleId | null {
  if (!isValidTextureHandleId(value)) return null;
  return value as TextureHandleId;
}

// Type guard function
export function isTextureHandleId(value: unknown): value is TextureHandleId {
  return typeof value === "string" && isValidTextureHandleId(value as string);
}

// Existing validation function (unchanged)
export function isValidTextureHandleId(id: string): boolean {
  return TEXTURE_HANDLE_ID_REGEX.test(id);
}

// Helper function for generating handle IDs
export function generateTextureHandleId(index: number): TextureHandleId {
  const handleId = `input-${index + 1}`;
  return handleId as TextureHandleId;
}
```

### OutputHandleId Type

```typescript
// TypeScript branded type for output handles
export type OutputHandleId = string & { readonly __brand: "OutputHandleId" };

// Regular expression for output handles
export const OUTPUT_HANDLE_ID_REGEX = /^output-[a-z0-9-]+$/;

// Safe constructor function
export function createOutputHandleId(value: string): OutputHandleId | null {
  if (!isValidOutputHandleId(value)) return null;
  return value as OutputHandleId;
}

// Type guard function
export function isOutputHandleId(value: unknown): value is OutputHandleId {
  return typeof value === "string" && isValidOutputHandleId(value as string);
}

// Validation function
export function isValidOutputHandleId(id: string): boolean {
  return OUTPUT_HANDLE_ID_REGEX.test(id);
}

// Helper function
export function generateOutputHandleId(name: string): OutputHandleId | null {
  const id = `output-${name}`;
  return createOutputHandleId(id);
}
```

### Zod Schema Integration

```typescript
// Update the Zod schema to use the new types
export const $TextureHandleId = z.custom<TextureHandleId>(
  (val) => typeof val === "string" && isValidTextureHandleId(val as string),
  {
    message:
      "Handle ID must be in the format 'input-N' where N is a positive integer",
  },
);

export const $OutputHandleId = z.custom<OutputHandleId>(
  (val) => typeof val === "string" && isValidOutputHandleId(val as string),
  {
    message: "Output handle ID must be in the format 'output-name'",
  },
);

// Union type for all handle IDs
export const $HandleId = z.union([$TextureHandleId, $OutputHandleId]);
export type HandleId = TextureHandleId | OutputHandleId;
```

### Utility Functions

```typescript
// Create multiple handles at once
export function createTextureHandleIds(count: number): TextureHandleId[] {
  return Array.from({ length: count }, (_, i) => generateTextureHandleId(i));
}

export function createOutputHandleIds(names: string[]): OutputHandleId[] {
  return names
    .map((name) => generateOutputHandleId(name))
    .filter((id): id is OutputHandleId => id !== null);
}
```

## Dependencies

None - this is the first phase in the implementation plan.

## Impact Analysis

| Component          | Changes Required                                           |
| ------------------ | ---------------------------------------------------------- |
| `TextureHandle.ts` | Update core type definitions, add branded types            |
| `Edge.ts`          | No changes yet (handled in Phase 3)                        |
| Runtime code       | No immediate impact, type-checking happens at compile time |

## Acceptance Criteria

1. ✅ `TextureHandleId` is a branded type that enforces compile-time validation
2. ✅ `OutputHandleId` is a branded type that supports multiple outputs
3. ✅ Constructor functions validate handles during creation
4. ✅ Type guards work correctly for runtime validation
5. ✅ Zod schemas updated to use the new types
6. ✅ Utility functions work correctly for creating multiple handles
7. ✅ All existing tests continue to pass
