# Rethinking TextureUniform and Texture Update Architecture

## TextureUniform Analysis

The current `TextureUniform` type has the following structure:

```typescript
export interface TextureReference {
  id: string | null; // The ID of the source texture node
  textureObject: THREE.Texture | null; // The actual WebGL/Three.js texture object
  isConnected: boolean; // Whether this texture input has a connection
}
```

### Is `textureObject` Necessary?

Unlike `isConnected` which is redundant (it can be derived from `id !== null`), the `textureObject` field serves a critical purpose:

1. **Decoupling Data and Rendering**: It separates the connection information (`id`) from the actual WebGL resource (`textureObject`).
2. **Performance**: Caching the actual texture object prevents having to look it up repeatedly during render cycles.
3. **Resource Management**: It allows for proper tracking of WebGL resources for cleanup and disposal.

**Recommendation**: Keep `textureObject` but remove `isConnected`.

```typescript
export interface TextureReference {
  id: string | null; // The ID of the source texture node
  textureObject: THREE.Texture | null; // The actual WebGL/Three.js texture object
}
```

## Unified Texture Update Architecture

Currently, we have separate hooks for each texture type:

- `useUpdateTextureAdd`
- `useUpdateTextureDisplace`
- `useUpdateTextureLimit`
- `useUpdateTextureNoise`

These hooks share significant common logic but are specialized for their specific texture types.

### Problems with Current Approach

1. **Duplication**: Similar logic repeated across multiple hooks
2. **Tight Coupling**: Each hook is tightly coupled to its texture type
3. **Maintenance Burden**: Changes must be made in multiple places
4. **Inconsistency**: Different hooks handle connections differently (some with `connectionCache.current[id]`, others with `connectionCache.current[id][handleId]`)

### Implementation Steps

#### Phase 8.1: Update TextureUniform Type

1. **Update TextureUniform Type to Remove Redundant isConnected Field**

```typescript
// In packages/webgl/src/types/texture-uniform.ts

/**
 * Updated interface without redundant isConnected field
 */
export interface TextureReference {
  id: string | null; // The ID of the source texture node
  textureObject: THREE.Texture | null; // The actual WebGL/Three.js texture object
}

/**
 * Updated Zod schema for texture uniforms
 */
export const $TextureUniform = z
  .object({
    id: z.string().nullable(),
    textureObject: z.any().nullable(), // Can't strongly type THREE.Texture in Zod
  })
  .nullable();

export type TextureUniform = z.infer<typeof $TextureUniform>;
```

#### Phase 8.2: Update Factory Functions

```typescript
/**
 * Update the factory functions to remove isConnected
 */
export function createTextureUniform(
  id: string | null = null,
  textureObject: THREE.Texture | null = null,
): TextureUniform {
  return {
    id,
    textureObject,
  };
}

/**
 * Update the existing TextureUniform
 */
export function updateTextureUniform(
  uniform: TextureUniform,
  id: string | null,
  textureObject: THREE.Texture | null,
): TextureUniform {
  if (!uniform) {
    return createTextureUniform(id, textureObject);
  }

  return {
    ...uniform,
    id,
    textureObject,
  };
}

/**
 * Helper function to check if a texture is connected
 */
export function isTextureConnected(uniform: TextureUniform): boolean {
  return !!uniform?.id;
}
```

#### Phase 8.3: Update Type Guard Function

```typescript
/**
 * Check if a value is a TextureUniform
 */
export function isTextureUniform(value: unknown): value is TextureUniform {
  return (
    value !== null &&
    typeof value === "object" &&
    "id" in value &&
    ("textureObject" in value || value.textureObject === null)
  );
}
```

#### Phase 8.4: Update Shader Implementations

```typescript
// In packages/webgl/src/shaders/add.ts, displace.ts, etc.
// Update texture uniform initialization
const defaultUniforms = {
  u_texture1: createTextureUniform(null, null),
  u_texture2: createTextureUniform(null, null),
  // Other uniforms...
};
```

#### Phase 8.5: Update Hook Implementations

```typescript
// In apps/app/src/app/(app)/(workspace)/workspace/hooks/use-update-texture-add.ts
// Replace isConnected checks with isTextureConnected utility

// Before:
if (isTextureUniform(u[uniformName as keyof typeof u])) {
  (u[uniformName as keyof typeof u] as any) = updateTextureUniform(
    u[uniformName as keyof typeof u] as any,
    sourceId,
    textureObject,
    !!sourceId, // <-- isConnected parameter
  );
}

// After:
if (isTextureUniform(u[uniformName as keyof typeof u])) {
  (u[uniformName as keyof typeof u] as any) = updateTextureUniform(
    u[uniformName as keyof typeof u] as any,
    sourceId,
    textureObject,
  );
}
```
