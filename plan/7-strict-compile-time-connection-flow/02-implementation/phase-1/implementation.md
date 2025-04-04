# Phase 1: Enhanced Handle Types - Implementation

## File Changes

### Update TextureHandle.ts

```typescript
// vendor/db/src/schema/types/TextureHandle.ts
import { z } from "zod";

import { getTextureInputsForType } from "@repo/webgl";

// Regular expression for validating handle IDs (unchanged)
export const TEXTURE_HANDLE_ID_REGEX = /^input-\d+$/;

// New: TypeScript branded type for TextureHandleId
export type TextureHandleId = string & { readonly __brand: "TextureHandleId" };

// New: TypeScript branded type for OutputHandleId
export type OutputHandleId = string & { readonly __brand: "OutputHandleId" };

// New: Union type for all handle types
export type HandleId = TextureHandleId | OutputHandleId;

// New: Regular expression for output handles
export const OUTPUT_HANDLE_ID_REGEX = /^output-[a-z0-9-]+$/;

// Update the Zod schema to use custom validation
export const $TextureHandleId = z.custom<TextureHandleId>(
  (val) => typeof val === "string" && isValidTextureHandleId(val as string),
  {
    message:
      "Handle ID must be in the format 'input-N' where N is a positive integer",
  },
);

// New: Zod schema for OutputHandleId
export const $OutputHandleId = z.custom<OutputHandleId>(
  (val) => typeof val === "string" && isValidOutputHandleId(val as string),
  {
    message: "Output handle ID must be in the format 'output-name'",
  },
);

// New: Union type Zod schema
export const $HandleId = z.union([$TextureHandleId, $OutputHandleId]);

// Existing validation function (unchanged)
export function isValidTextureHandleId(id: string): boolean {
  return TEXTURE_HANDLE_ID_REGEX.test(id);
}

// New: Validation function for output handles
export function isValidOutputHandleId(id: string): boolean {
  return OUTPUT_HANDLE_ID_REGEX.test(id);
}

// New: Constructor function for TextureHandleId
export function createTextureHandleId(value: string): TextureHandleId | null {
  if (!isValidTextureHandleId(value)) return null;
  return value as TextureHandleId;
}

// New: Constructor function for OutputHandleId
export function createOutputHandleId(value: string): OutputHandleId | null {
  if (!isValidOutputHandleId(value)) return null;
  return value as OutputHandleId;
}

// New: Type guard for TextureHandleId
export function isTextureHandleId(value: unknown): value is TextureHandleId {
  return typeof value === "string" && isValidTextureHandleId(value as string);
}

// New: Type guard for OutputHandleId
export function isOutputHandleId(value: unknown): value is OutputHandleId {
  return typeof value === "string" && isValidOutputHandleId(value as string);
}

// Helper function (updated to use branded type)
export function generateTextureHandleId(index: number): TextureHandleId {
  const handleId = `input-${index + 1}`;
  return handleId as TextureHandleId;
}

// New: Helper function for generating output handles
export function generateOutputHandleId(name: string): OutputHandleId | null {
  const id = `output-${name}`;
  return createOutputHandleId(id);
}

// New: Helper for creating multiple texture handles
export function createTextureHandleIds(count: number): TextureHandleId[] {
  return Array.from({ length: count }, (_, i) => generateTextureHandleId(i));
}

// New: Helper for creating multiple output handles
export function createOutputHandleIds(names: string[]): OutputHandleId[] {
  return names
    .map((name) => generateOutputHandleId(name))
    .filter((id): id is OutputHandleId => id !== null);
}

// The rest of the file can remain largely unchanged
export function getTextureHandleIndex(handleId: string): number | null {
  if (!isValidTextureHandleId(handleId)) return null;
  const match = /^input-(\d+)$/.exec(handleId);
  if (!match?.[1]) return null;
  return parseInt(match[1], 10) - 1;
}

// Updated to use TextureHandleId type but preserve backward compatibility
export function getUniformNameFromTextureHandleId(
  handleId: string | TextureHandleId,
): string | null {
  if (!isValidTextureHandleId(handleId)) return null;
  const index = getTextureHandleIndex(handleId);
  if (index === null) return null;
  return `u_texture${index + 1}`;
}

// Updated to use TextureHandleId type but preserve backward compatibility
export function getTextureHandleIdFromUniformName(
  uniformName: string,
): TextureHandleId | null {
  const match = /^u_texture(\d+)$/.exec(uniformName);
  if (!match?.[1]) return null;
  const index = parseInt(match[1], 10);
  return generateTextureHandleId(index - 1);
}

// Function still returns string[] for backward compatibility
export function getTextureInputsMetadata(textureType: string): {
  id: string;
  uniformName: string;
  description: string;
  required: boolean;
}[] {
  // Delegate to the registry function
  return getTextureInputsForType(textureType);
}
```

## Unit Tests

Create a new test file to verify the functionality of the enhanced handle types:

```typescript
// vendor/db/src/__tests__/texture-handle.test.ts
import {
  createOutputHandleId,
  createOutputHandleIds,
  createTextureHandleId,
  createTextureHandleIds,
  generateOutputHandleId,
  generateTextureHandleId,
  isOutputHandleId,
  isTextureHandleId,
  isValidOutputHandleId,
  isValidTextureHandleId,
  OutputHandleId,
  TextureHandleId,
} from "../schema/types/TextureHandle";

describe("TextureHandleId", () => {
  test("creates valid TextureHandleId", () => {
    const id = createTextureHandleId("input-1");
    expect(id).toBe("input-1");
    // TypeScript should recognize this as a TextureHandleId
    const typed: TextureHandleId = id as TextureHandleId;
    expect(typed).toBe(id);
  });

  test("returns null for invalid TextureHandleId", () => {
    expect(createTextureHandleId("invalid")).toBeNull();
    expect(createTextureHandleId("output-1")).toBeNull();
  });

  test("generates TextureHandleId from index", () => {
    expect(generateTextureHandleId(0)).toBe("input-1");
    expect(generateTextureHandleId(1)).toBe("input-2");
  });

  test("validates TextureHandleId with type guard", () => {
    expect(isTextureHandleId("input-1")).toBe(true);
    expect(isTextureHandleId("invalid")).toBe(false);
    expect(isTextureHandleId(null)).toBe(false);
    expect(isTextureHandleId(undefined)).toBe(false);
    expect(isTextureHandleId(123)).toBe(false);
  });

  test("validates with isValidTextureHandleId", () => {
    expect(isValidTextureHandleId("input-1")).toBe(true);
    expect(isValidTextureHandleId("input-99")).toBe(true);
    expect(isValidTextureHandleId("invalid")).toBe(false);
    expect(isValidTextureHandleId("output-1")).toBe(false);
  });

  test("creates multiple TextureHandleIds", () => {
    const ids = createTextureHandleIds(3);
    expect(ids).toHaveLength(3);
    expect(ids[0]).toBe("input-1");
    expect(ids[1]).toBe("input-2");
    expect(ids[2]).toBe("input-3");
  });
});

describe("OutputHandleId", () => {
  test("creates valid OutputHandleId", () => {
    const id = createOutputHandleId("output-main");
    expect(id).toBe("output-main");
    // TypeScript should recognize this as an OutputHandleId
    const typed: OutputHandleId = id as OutputHandleId;
    expect(typed).toBe(id);
  });

  test("returns null for invalid OutputHandleId", () => {
    expect(createOutputHandleId("invalid")).toBeNull();
    expect(createOutputHandleId("input-1")).toBeNull();
  });

  test("generates OutputHandleId from name", () => {
    expect(generateOutputHandleId("main")).toBe("output-main");
    expect(generateOutputHandleId("mask")).toBe("output-mask");
  });

  test("validates OutputHandleId with type guard", () => {
    expect(isOutputHandleId("output-main")).toBe(true);
    expect(isOutputHandleId("invalid")).toBe(false);
    expect(isOutputHandleId(null)).toBe(false);
    expect(isOutputHandleId(undefined)).toBe(false);
    expect(isOutputHandleId(123)).toBe(false);
  });

  test("validates with isValidOutputHandleId", () => {
    expect(isValidOutputHandleId("output-main")).toBe(true);
    expect(isValidOutputHandleId("output-mask")).toBe(true);
    expect(isValidOutputHandleId("invalid")).toBe(false);
    expect(isValidOutputHandleId("input-1")).toBe(false);
  });

  test("creates multiple OutputHandleIds", () => {
    const ids = createOutputHandleIds(["main", "mask", "normal"]);
    expect(ids).toHaveLength(3);
    expect(ids[0]).toBe("output-main");
    expect(ids[1]).toBe("output-mask");
    expect(ids[2]).toBe("output-normal");
  });
});
```

## Implementation Notes

1. Since we're using branded types with TypeScript, the actual runtime values remain strings. The branding only exists at compile-time to provide stronger type checking.

2. We're introducing the concept of `OutputHandleId` to support multiple outputs on nodes. This follows the same pattern as `TextureHandleId` but with a different validation format.

3. We're careful to maintain backward compatibility by:

   - Keeping existing functions that operate on strings
   - Adding parallel functions that work with the new typed IDs
   - Using type guards to validate at runtime

4. The regex validation remains unchanged for `TextureHandleId` but we add a new pattern for `OutputHandleId`.

## Migration Impact

This change is focused on type safety and should have minimal runtime impact. Existing code will continue to work with string handle IDs, while new code can take advantage of the enhanced type safety.

The main benefit will come in later phases when we start enforcing these types across the codebase, which will help catch potential errors at compile time rather than runtime.
