# Handle Type System

## Overview

The handle type system provides compile-time type safety for texture handles and node connections in React TD. It uses TypeScript branded types to ensure handle IDs follow the required format and provides utilities for validation, conversion, and type checking.

## TextureHandleId Type

```typescript
// Branded type for compile-time safety
export type TextureHandleId = string & { readonly __brand: "TextureHandleId" };

// Regular expression for validation
export const TEXTURE_HANDLE_ID_REGEX = /^input-\d+$/;

// Smart constructor ensures format is valid
export function createTextureHandleId(value: string): TextureHandleId | null {
  if (!isValidTextureHandleId(value)) return null;
  return value as TextureHandleId;
}

// Type guard for runtime checks
export function isTextureHandleId(value: unknown): value is TextureHandleId {
  return typeof value === "string" && isValidTextureHandleId(value as string);
}

// Validation function
export function isValidTextureHandleId(id: string): boolean {
  return TEXTURE_HANDLE_ID_REGEX.test(id);
}

// Helper to generate handle ID from index
export function generateTextureHandleId(index: number): TextureHandleId {
  const handleId = `input-${index + 1}`;
  return handleId as TextureHandleId;
}
```

## OutputHandleId Type

```typescript
// Branded type for output handles
export type OutputHandleId = string & { readonly __brand: "OutputHandleId" };

// Regular expression for output handles
export const OUTPUT_HANDLE_ID_REGEX = /^output-[a-z0-9-]+$/;

// Constructor function
export function createOutputHandleId(value: string): OutputHandleId | null {
  if (!isValidOutputHandleId(value)) return null;
  return value as OutputHandleId;
}

// Type guard
export function isOutputHandleId(value: unknown): value is OutputHandleId {
  return typeof value === "string" && isValidOutputHandleId(value as string);
}

// Validation function
export function isValidOutputHandleId(id: string): boolean {
  return OUTPUT_HANDLE_ID_REGEX.test(id);
}

// Helper generator
export function generateOutputHandleId(name: string): OutputHandleId | null {
  const id = `output-${name}`;
  return createOutputHandleId(id);
}
```

## HandleId Union Type

```typescript
// Union type for all handle types
export type HandleId = TextureHandleId | OutputHandleId;

// Type guard for any valid handle
export function isHandleId(value: unknown): value is HandleId {
  return isTextureHandleId(value) || isOutputHandleId(value);
}
```

## Zod Schema Integration

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

// Union schema
export const $HandleId = z.union([$TextureHandleId, $OutputHandleId]);
```

## Utility Functions

```typescript
// Create multiple handles at once
export function createTextureHandleIds(count: number): TextureHandleId[] {
  return Array.from({ length: count }, (_, i) => generateTextureHandleId(i));
}

// Create multiple output handles
export function createOutputHandleIds(names: string[]): OutputHandleId[] {
  return names
    .map((name) => generateOutputHandleId(name))
    .filter((id): id is OutputHandleId => id !== null);
}

// Get texture handle index
export function getTextureHandleIndex(handleId: string): number | null {
  if (!isValidTextureHandleId(handleId)) return null;
  const match = /^input-(\d+)$/.exec(handleId);
  if (!match?.[1]) return null;
  return parseInt(match[1], 10) - 1;
}

// Get uniform name from handle ID
export function getUniformNameFromTextureHandleId(
  handleId: string | TextureHandleId,
): string | null {
  if (!isValidTextureHandleId(handleId)) return null;
  const index = getTextureHandleIndex(handleId);
  if (index === null) return null;
  return `u_texture${index + 1}`;
}

// Get handle ID from uniform name
export function getTextureHandleIdFromUniformName(
  uniformName: string,
): TextureHandleId | null {
  const match = /^u_texture(\d+)$/.exec(uniformName);
  if (!match?.[1]) return null;
  const index = parseInt(match[1], 10);
  return generateTextureHandleId(index - 1);
}
```

## Type Safety Benefits

1. **Compile-Time Validation**:

   - TypeScript errors for invalid handle formats
   - Distinguishes between input and output handles
   - Prevents assignment of wrong handle types

2. **Runtime Safety**:

   - Type guards for dynamic validation
   - Consistent validation across the codebase
   - Clear error messages for invalid handles

3. **Developer Experience**:

   - IDE autocomplete for handle-related functions
   - Static analysis catches errors early
   - Better documentation through types

4. **Refactoring Protection**:
   - Changes to handle format are checked at compile time
   - Rename operations maintain type safety
   - Easier to identify affected code

## Type Hierarchy Diagram

```
┌───────────────────┐      ┌───────────────────┐
│                   │      │                   │
│  TextureHandleId  │      │   OutputHandleId  │
│                   │      │                   │
└─────────┬─────────┘      └─────────┬─────────┘
          │                          │
          │                          │
          ▼                          ▼
    ┌────────────────────────────────────┐
    │                                    │
    │            HandleId                │
    │      (Union of both types)         │
    │                                    │
    └────────────────────────────────────┘
```
