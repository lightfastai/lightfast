# Phase 6: WebGL Registry - Implementation

## Overview

This phase updates the WebGL registry to work with the new handle type system, implementing a dependency inversion pattern to maintain proper architectural boundaries between WebGL and DB layers.

## Implementation Details

### Base TextureHandle Interface (WebGL)

```typescript
// packages/webgl/src/types/handle.ts
export interface TextureHandle {
  readonly id: string;
  readonly uniformName: string;
}

// Helper functions for WebGL layer
export function isTextureHandle(value: unknown): value is TextureHandle {
  return (
    typeof value === "object" &&
    value !== null &&
    "id" in value &&
    "uniformName" in value &&
    typeof value.id === "string" &&
    typeof value.uniformName === "string"
  );
}
```

### TextureFieldMetadata Update

```typescript
// packages/webgl/src/types/field.ts
import type { TextureHandle } from "./handle";

export interface TextureFieldMetadata {
  handle: TextureHandle; // Using interface instead of direct ID
  description: string;
  required: boolean;
}
```

### Texture Registry Implementation

```typescript
// packages/webgl/src/types/texture-registry.ts
import type { TextureFieldMetadata } from "./field";
import type { TextureHandle } from "./handle";

export interface TextureRegistry {
  [textureType: string]: {
    inputs: TextureFieldMetadata[];
    maxInputs: number;
  };
}

// Example registry with the new handle structure
export const textureRegistry: TextureRegistry = {
  noise: {
    inputs: [
      {
        handle: {
          id: "input-1",
          uniformName: "u_texture1",
        },
        description: "Displacement map",
        required: false,
      },
    ],
    maxInputs: 1,
  },
  displace: {
    inputs: [
      {
        handle: {
          id: "input-1",
          uniformName: "u_texture1",
        },
        description: "Base texture",
        required: true,
      },
      {
        handle: {
          id: "input-2",
          uniformName: "u_texture2",
        },
        description: "Displacement map",
        required: true,
      },
    ],
    maxInputs: 2,
  },
};

// Registry utility functions
export function getTextureInputsForType(
  textureType: string,
): TextureFieldMetadata[] {
  return textureRegistry[textureType]?.inputs ?? [];
}

export function isValidTextureHandleForType(
  textureType: string,
  handle: TextureHandle,
): boolean {
  const inputs = getTextureInputsForType(textureType);
  return inputs.some(
    (input) =>
      input.handle.id === handle.id &&
      input.handle.uniformName === handle.uniformName,
  );
}

export function isRequiredTextureHandle(
  textureType: string,
  handle: TextureHandle,
): boolean {
  const inputs = getTextureInputsForType(textureType);
  const input = inputs.find(
    (input) =>
      input.handle.id === handle.id &&
      input.handle.uniformName === handle.uniformName,
  );
  return input?.required ?? false;
}
```

### DB Layer Implementation

```typescript
// vendor/db/src/schema/types/TextureHandle.ts
import type { TextureHandle } from '@repo/webgl';

// Keep existing branded types
export type TextureHandleId = string & { readonly __brand: "TextureHandleId" };
export type OutputHandleId = string & { readonly __brand: "OutputHandleId" };
export type HandleId = TextureHandleId | OutputHandleId;

// Implement TextureHandle interface
export interface TextureHandleImpl implements TextureHandle {
  readonly id: TextureHandleId;
  readonly uniformName: string;
}

// Update existing functions to work with TextureHandle
export function createTextureHandle(value: string): TextureHandle | null {
  const handleId = createTextureHandleId(value);
  if (!handleId) return null;

  const uniformName = getUniformNameFromTextureHandleId(handleId);
  if (!uniformName) return null;

  return {
    id: handleId,
    uniformName,
  };
}

// Keep existing validation functions
export function isValidTextureHandleId(id: string): boolean {
  return TEXTURE_HANDLE_ID_REGEX.test(id);
}

// Update type guards
export function isTextureHandleId(value: unknown): value is TextureHandleId {
  return typeof value === "string" && isValidTextureHandleId(value);
}

// Update mapping functions
export function getUniformNameFromTextureHandleId(
  handleId: string | TextureHandleId,
): string | null {
  if (!isValidTextureHandleId(handleId)) return null;
  const index = getTextureHandleIndex(handleId);
  if (index === null) return null;
  return `u_texture${index + 1}`;
}

export function getTextureHandleFromUniformName(
  uniformName: string,
): TextureHandle | null {
  const match = /^u_texture(\d+)$/.exec(uniformName);
  if (!match?.[1]) return null;
  const index = parseInt(match[1], 10);
  const handleId = generateTextureHandleId(index - 1);
  return handleId ? createTextureHandle(handleId) : null;
}
```

## Implementation Notes

1. **Dependency Inversion**:

   - WebGL layer defines `TextureHandle` interface
   - DB layer implements the interface
   - No direct dependency on DB types in WebGL

2. **Handle-Uniform Mapping**:

   - Clear 1:1 mapping between handles and uniforms
   - `input-N` → `u_textureN` mapping preserved
   - Mapping logic centralized in DB layer

3. **Type Safety**:

   - Strong typing through interfaces and branded types
   - Validation at appropriate boundaries
   - Clear separation of concerns

4. **Registry Updates**:
   - Registry now works with `TextureHandle` interface
   - Simplified validation logic
   - Better encapsulation of WebGL concerns
