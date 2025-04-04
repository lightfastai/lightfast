# Phase 8: TextureUniform and Handle Integration

## Overview

This phase updates the TextureUniform system to work with the new TextureHandle interface and handle-uniform mapping.

## Implementation Details

### TextureUniform Update

```typescript
// packages/webgl/src/types/uniform.ts
import * as THREE from "three";

import type { TextureHandle } from "./handle";

export interface TextureUniform {
  handle: TextureHandle | null;
  textureObject: THREE.Texture | null;
}

export function createTextureUniform(
  handle: TextureHandle | null = null,
  textureObject: THREE.Texture | null = null,
): TextureUniform {
  return { handle, textureObject };
}

export function updateTextureUniform(
  uniform: TextureUniform,
  handle: TextureHandle | null,
  textureObject: THREE.Texture | null,
): TextureUniform {
  return { ...uniform, handle, textureObject };
}

export function isTextureConnected(uniform: TextureUniform): boolean {
  return !!uniform?.handle;
}

export function getUniformName(uniform: TextureUniform): string | null {
  return uniform?.handle?.uniformName ?? null;
}
```

### Shader Integration

```typescript
// packages/webgl/src/shaders/base.ts
import type { TextureHandle } from "../types/handle";
import type { TextureUniform } from "../types/uniform";

export interface ShaderUniforms {
  [key: string]:
    | TextureUniform
    | number
    | THREE.Vector2
    | THREE.Vector3
    | THREE.Vector4;
}

export function createDefaultUniforms(
  handles: TextureHandle[],
): ShaderUniforms {
  const uniforms: ShaderUniforms = {};

  handles.forEach((handle) => {
    uniforms[handle.uniformName] = createTextureUniform(null, null);
  });

  return uniforms;
}

export function updateShaderUniforms(
  shader: THREE.ShaderMaterial,
  uniforms: ShaderUniforms,
  handles: TextureHandle[],
): void {
  handles.forEach((handle) => {
    const uniform = uniforms[handle.uniformName];
    if (isTextureUniform(uniform)) {
      shader.uniforms[handle.uniformName].value = uniform.textureObject;
    }
  });
}
```

### Connection Cache Update

```typescript
// apps/app/src/app/(app)/(workspace)/workspace/hooks/use-connection-cache.ts
import type { TextureHandle } from "@repo/webgl";

export interface ConnectionCache {
  [nodeId: string]: {
    [handleId: string]: string | null; // source node ID or null
  };
}

export function useConnectionCache() {
  const connectionCache = useRef<ConnectionCache>({});
  const { edges } = useEdgeStore();

  useEffect(() => {
    // Initialize cache for all nodes
    Object.keys(targets).forEach((nodeId) => {
      if (!connectionCache.current[nodeId]) {
        connectionCache.current[nodeId] = {};
      }
    });

    // Update cache based on edges
    edges.forEach((edge) => {
      const targetId = edge.target;
      const sourceId = edge.source;
      const handleId = edge.targetHandle;

      if (connectionCache.current[targetId] && handleId) {
        connectionCache.current[targetId][handleId] = sourceId;
      }
    });
  }, [edges, targets]);

  return connectionCache;
}
```

### Texture Update Integration

```typescript
// apps/app/src/app/(app)/(workspace)/workspace/hooks/use-update-texture.ts
import type { TextureHandle } from "@repo/webgl";

export function useUpdateTexture(textureType: string) {
  const connectionCache = useConnectionCache();
  const { targets } = useTextureRenderStore();

  const updateTextureUniforms = useCallback(
    (
      shader: THREE.ShaderMaterial,
      nodeId: string,
      handles: TextureHandle[],
    ) => {
      handles.forEach((handle) => {
        const sourceId = connectionCache.current[nodeId]?.[handle.id];
        const textureObject =
          sourceId && targets[sourceId]?.texture
            ? targets[sourceId].texture
            : null;

        if (shader.uniforms[handle.uniformName]) {
          shader.uniforms[handle.uniformName].value = textureObject;
        }
      });
    },
    [connectionCache, targets],
  );

  return {
    updateTextureUniforms,
  };
}
```

## Implementation Notes

1. **TextureUniform Improvements**:

   - Clear connection to TextureHandle interface
   - Simplified uniform management
   - Better type safety
   - Removed redundant fields

2. **Handle-Uniform Integration**:

   - Direct mapping through TextureHandle
   - Consistent uniform naming
   - Clear connection tracking
   - Type-safe updates

3. **Resource Management**:

   - Better texture object tracking
   - Clear ownership of resources
   - Proper cleanup handling
   - Optimized updates

4. **Type Safety**:
   - Strong typing throughout
   - Clear validation boundaries
   - Consistent error handling
   - Better IDE support
