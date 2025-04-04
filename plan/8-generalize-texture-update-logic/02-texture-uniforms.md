# Phase 2: Texture Uniform Handling

## Overview

Implement a generalized system for handling texture uniforms with connection validation and caching, integrating with the existing texture registry using functional programming patterns.

## Implementation

### 1. Texture Handle Types

```typescript
// packages/webgl/src/types/texture-handle.ts
import type { TextureFieldMetadata, UniformFieldValue } from "./field";
import type { ValueType } from "./schema";

export interface TextureHandle {
  readonly id: string;
  readonly uniformName: string;
}

export interface TextureConnection {
  readonly sourceId: string | null;
  readonly targetId: string;
  readonly handleId: string;
  readonly textureObject: THREE.Texture | null;
}

export interface TextureConnectionCache {
  readonly [nodeId: string]: {
    readonly [handleId: string]: TextureConnection;
  };
}

// Reuse existing createTextureHandle function
export { createTextureHandle } from "../types/handle";

// Reuse existing isTextureHandle function
export { isTextureHandle } from "../types/handle";

/**
 * Create texture field metadata from uniform constraints
 */
export function createTextureFieldMetadata(
  handle: TextureHandle,
  constraint: UniformFieldValue,
): TextureFieldMetadata {
  if (constraint.type !== ValueType.Texture) {
    throw new Error(`Invalid constraint type for handle ${handle.id}`);
  }
  const textureConstraint = constraint.constraint as TextureFieldMetadata;
  return {
    handle,
    description: textureConstraint.description || constraint.label,
    required: textureConstraint.required || false,
  };
}
```

### 2. Connection Management

```typescript
// packages/webgl/src/utils/connection-utils.ts
import type {
  TextureConnection,
  TextureConnectionCache,
  TextureHandle,
} from "../types/texture-handle";
import {
  isRequiredTextureHandle,
  isValidTextureHandleForType,
  textureRegistry,
} from "../registry/texture-registry";

/**
 * Create a new connection
 */
export function createConnection(
  targetId: string,
  handleId: string,
  sourceId: string | null,
  textureObject: THREE.Texture | null,
): TextureConnection {
  return {
    sourceId,
    targetId,
    handleId,
    textureObject,
  };
}

/**
 * Update the connection cache with a new connection
 */
export function updateConnectionCache(
  cache: TextureConnectionCache,
  connection: TextureConnection,
): TextureConnectionCache {
  const { targetId, handleId } = connection;
  return {
    ...cache,
    [targetId]: {
      ...(cache[targetId] || {}),
      [handleId]: connection,
    },
  };
}

/**
 * Get a connection from the cache
 */
export function getConnection(
  cache: TextureConnectionCache,
  targetId: string,
  handleId: string,
): TextureConnection | null {
  return cache[targetId]?.[handleId] || null;
}

/**
 * Remove all connections for a node
 */
export function clearNodeConnections(
  cache: TextureConnectionCache,
  nodeId: string,
): TextureConnectionCache {
  const { [nodeId]: _, ...rest } = cache;
  return rest;
}

/**
 * Validate a connection
 */
export function validateConnection(
  textureType: string,
  handle: TextureHandle,
  sourceType: string | null,
): boolean {
  // First validate the handle is valid for this texture type
  if (!isValidTextureHandleForType(textureType, handle)) {
    return false;
  }

  // Check if connection is required
  if (!sourceType) {
    return !isRequiredTextureHandle(textureType, handle);
  }

  // Use the registry's validation function
  const entry = textureRegistry[textureType];
  return entry?.validateConnection(handle, sourceType) ?? false;
}
```

### 3. Texture Update Hook

```typescript
// apps/app/src/app/(app)/(workspace)/workspace/hooks/use-update-texture.ts
import { useCallback, useEffect, useRef } from "react";

import type { TextureConnectionCache, TextureHandle } from "@repo/webgl";
import {
  getDefaultTextureUniforms,
  getTextureHandles,
  textureRegistry,
} from "@repo/webgl";

import {
  createConnection,
  getConnection,
  updateConnectionCache,
  validateConnection,
} from "../utils/connection-utils";

export function useUpdateTexture(textureType: string) {
  // Use ref for connection cache to maintain across renders
  const connectionCache = useRef<TextureConnectionCache>({});

  const { targets } = useTextureRenderStore();
  const { edges } = useEdgeStore();
  const { nodeTypes } = useNodeStore();

  // Update connections when edges change
  useEffect(() => {
    edges.forEach((edge) => {
      const sourceId = edge.source;
      const targetId = edge.target;
      const handleId = edge.targetHandle;

      if (!handleId) return;

      const textureObject = targets[sourceId]?.texture || null;
      const connection = createConnection(
        targetId,
        handleId,
        sourceId,
        textureObject,
      );

      connectionCache.current = updateConnectionCache(
        connectionCache.current,
        connection,
      );
    });
  }, [edges, targets]);

  const updateTextureUniforms = useCallback(
    (shader: THREE.ShaderMaterial, nodeId: string) => {
      // Get handles for this texture type
      const handles = getTextureHandles(textureType);

      // Get default uniforms
      const defaultUniforms = getDefaultTextureUniforms(textureType);

      // Update each handle
      handles.forEach((handle) => {
        const connection = getConnection(
          connectionCache.current,
          nodeId,
          handle.id,
        );
        const sourceType = connection?.sourceId
          ? nodeTypes[connection.sourceId]
          : null;

        // Validate connection
        if (
          connection?.sourceId &&
          sourceType &&
          !validateConnection(textureType, handle, sourceType)
        ) {
          console.warn(
            `Invalid connection for ${textureType} texture at handle ${handle.id}`,
          );
          return;
        }

        // Update shader uniform
        if (shader.uniforms[handle.uniformName]) {
          shader.uniforms[handle.uniformName].value =
            connection?.textureObject ??
            defaultUniforms[handle.uniformName]?.textureObject ??
            null;
        }
      });
    },
    [textureType, nodeTypes],
  );

  return {
    updateTextureUniforms,
    getConnection: useCallback(
      (nodeId: string, handleId: string) =>
        getConnection(connectionCache.current, nodeId, handleId),
      [],
    ),
  };
}
```

## Migration Steps

1. **Functional Transformation**

   - Convert class-based code to pure functions
   - Make data structures immutable
   - Use composition over inheritance

2. **Update Connection Management**

   - Use pure functions for connection operations
   - Maintain immutable connection cache
   - Implement functional validation

3. **Enhance Update Hook**

   - Use functional utilities
   - Maintain immutable state
   - Implement pure update functions

4. **Testing**
   - Test pure functions
   - Validate immutability
   - Check composition patterns

## Validation

1. **Type Safety**

   - Use readonly types
   - Enforce immutability
   - Maintain pure functions

2. **Performance**

   - Optimize immutable updates
   - Use efficient data structures
   - Minimize state changes

3. **Error Handling**
   - Use functional error handling
   - Return validated results
   - Maintain pure error states
