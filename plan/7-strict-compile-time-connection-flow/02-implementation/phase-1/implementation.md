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

## Implementation Notes

1. Since we're using branded types with TypeScript, the actual runtime values remain strings. The branding only exists at compile-time to provide stronger type checking.

2. We're introducing the concept of `OutputHandleId` to support multiple outputs on nodes. This follows the same pattern as `TextureHandleId` but with a different validation format.

3. We're careful to maintain backward compatibility by:

   - Keeping existing functions that operate on strings
   - Adding parallel functions that work with the new typed IDs
   - Using type guards to validate at runtime

4. The regex validation remains unchanged for `TextureHandleId` but we add a new pattern for `OutputHandleId`.
