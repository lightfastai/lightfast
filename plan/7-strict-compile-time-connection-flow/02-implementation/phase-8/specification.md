# Phase 8: Texture Uniform System

## Overview

This phase implements a type-safe texture uniform system that integrates with our handle-based architecture, providing efficient resource management and proper cleanup.

## Requirements

### Texture Uniform System

1. **Uniform Management**

   - Type-safe uniform handling
   - Resource management
   - Proper cleanup
   - Performance optimization

2. **Handle Integration**

   - Handle-uniform mapping
   - Type safety
   - Validation
   - Error handling

3. **Resource Management**
   - Texture cleanup
   - Memory management
   - Resource pooling
   - Cache invalidation

### Type Definitions

```typescript
// packages/webgl/src/types/uniform.ts
export interface TextureUniform {
  handle: TextureHandle | null;
  textureObject: THREE.Texture | null;
}

export interface UniformManager {
  createUniform: (handle: TextureHandle | null) => TextureUniform;
  updateUniform: (
    uniform: TextureUniform,
    handle: TextureHandle | null,
    texture: THREE.Texture | null,
  ) => TextureUniform;
  disposeUniform: (uniform: TextureUniform) => void;
  isConnected: (uniform: TextureUniform) => boolean;
}

export interface UniformCache {
  [nodeId: string]: {
    [uniformName: string]: TextureUniform;
  };
}
```

### Uniform Implementation

```typescript
// packages/webgl/src/uniform/texture-uniform.ts
export function createUniformManager(): UniformManager {
  return {
    createUniform(handle: TextureHandle | null): TextureUniform {
      return {
        handle,
        textureObject: null,
      };
    },

    updateUniform(
      uniform: TextureUniform,
      handle: TextureHandle | null,
      texture: THREE.Texture | null,
    ): TextureUniform {
      // Dispose old texture if needed
      if (uniform.textureObject && uniform.textureObject !== texture) {
        uniform.textureObject.dispose();
      }

      return {
        handle,
        textureObject: texture,
      };
    },

    disposeUniform(uniform: TextureUniform): void {
      if (uniform.textureObject) {
        uniform.textureObject.dispose();
      }
    },

    isConnected(uniform: TextureUniform): boolean {
      return !!uniform.handle;
    },
  };
}
```

### Hook Integration

```typescript
// packages/webgl/src/hooks/use-texture-uniforms.ts
export function useTextureUniforms(nodeId: string, textureType: string) {
  const uniformManager = useMemo(() => createUniformManager(), []);
  const uniformCache = useRef<UniformCache>({});
  const { targets } = useTextureRenderStore();
  const connectionCache = useConnectionCache();

  // Initialize uniforms
  useEffect(() => {
    const config = TEXTURE_REGISTRY[textureType];
    if (!config) return;

    uniformCache.current[nodeId] = {};

    Object.values(config.fields).forEach((field) => {
      uniformCache.current[nodeId][field.handle.uniformName] =
        uniformManager.createUniform(null);
    });

    return () => {
      // Cleanup uniforms
      Object.values(uniformCache.current[nodeId] || {}).forEach((uniform) => {
        uniformManager.disposeUniform(uniform);
      });
      delete uniformCache.current[nodeId];
    };
  }, [nodeId, textureType, uniformManager]);

  // Update uniforms
  useEffect(() => {
    const config = TEXTURE_REGISTRY[textureType];
    if (!config) return;

    Object.values(config.fields).forEach((field) => {
      const sourceId = connectionCache.current[nodeId]?.[field.handle.id];
      const textureObject =
        sourceId && targets[sourceId]?.texture
          ? targets[sourceId].texture
          : null;

      const uniform = uniformCache.current[nodeId][field.handle.uniformName];
      uniformCache.current[nodeId][field.handle.uniformName] =
        uniformManager.updateUniform(
          uniform,
          sourceId ? field.handle : null,
          textureObject,
        );
    });
  }, [nodeId, textureType, targets, connectionCache, uniformManager]);

  return {
    getUniform: useCallback(
      (uniformName: string) => uniformCache.current[nodeId]?.[uniformName],
      [nodeId],
    ),
    isConnected: useCallback(
      (uniformName: string) =>
        uniformManager.isConnected(uniformCache.current[nodeId]?.[uniformName]),
      [nodeId, uniformManager],
    ),
  };
}
```

## Implementation Guidelines

1. **Type Safety**

   - Use strict TypeScript
   - Proper type guards
   - Clear boundaries
   - Type inference

2. **Resource Management**

   - Proper cleanup
   - Memory management
   - Resource pooling
   - Cache invalidation

3. **Performance**

   - Efficient updates
   - Smart caching
   - Minimal allocations
   - Proper cleanup

4. **Error Handling**
   - Clear messages
   - Type safety
   - Recovery options
   - Logging

## Success Criteria

1. **Type Safety**

   - No type errors
   - Clear boundaries
   - Type inference
   - Documentation

2. **Resource Management**

   - Proper cleanup
   - No leaks
   - Efficient usage
   - Clear ownership

3. **Performance**

   - Fast updates
   - Minimal overhead
   - Smart caching
   - Efficient memory

4. **Integration**
   - Clean boundaries
   - No circular deps
   - Clear interfaces
   - Easy to use

## Testing Requirements

1. **Type Tests**

   - Type inference
   - Type guards
   - Edge cases
   - Boundaries

2. **Resource Tests**

   - Cleanup
   - Memory usage
   - Resource limits
   - Error cases

3. **Performance Tests**
   - Update speed
   - Memory usage
   - Cache efficiency
   - Resource usage

## Documentation Requirements

1. **Type Documentation**

   - Interfaces
   - Type guards
   - Usage examples
   - Best practices

2. **Resource Documentation**

   - Cleanup patterns
   - Memory management
   - Resource limits
   - Best practices

3. **API Documentation**
   - Public interfaces
   - Usage examples
   - Error handling
   - Performance tips
