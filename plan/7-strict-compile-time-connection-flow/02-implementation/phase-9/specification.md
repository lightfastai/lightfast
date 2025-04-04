# Phase 9: Unified Texture Update System

## Overview

This phase implements a unified texture update system that provides consistent behavior across all texture types while maintaining type safety and clean architectural boundaries. The system integrates with our handle-based architecture and prepares for expression system integration.

## Requirements

### Texture Type Registry

1. **Registry Structure**

   - Type-safe texture type definitions
   - Handle registration and validation
   - Default uniform configurations
   - Update strategy definitions

2. **Type Definitions**

```typescript
// packages/webgl/src/types/texture-registry.ts
export interface TextureTypeConfig {
  type: string;
  defaultUniforms: Record<string, UniformValue>;
  handles: {
    inputs: HandleConfig[];
    outputs: HandleConfig[];
  };
  validate: (uniforms: Record<string, UniformValue>) => ValidationResult;
}

export interface TextureRegistry {
  [textureType: string]: TextureTypeConfig;
}

export interface HandleConfig {
  id: string;
  type: HandleType;
  required: boolean;
  defaultValue?: UniformValue;
}

export interface UniformValue {
  type: "float" | "vec2" | "vec3" | "vec4" | "sampler2D";
  value: number | number[] | THREE.Texture;
}
```

### Unified Update Hook

```typescript
// packages/webgl/src/hooks/use-texture-update.ts
export interface TextureUpdateConfig {
  nodeId: string;
  textureType: string;
  uniforms: Record<string, UniformValue>;
  handles: TextureHandle[];
}

export function useTextureUpdate(config: TextureUpdateConfig) {
  const { nodeId, textureType, uniforms, handles } = config;

  // Validation and update logic
  const updateTexture = useCallback(
    (newUniforms: Partial<Record<string, UniformValue>>) => {
      const typeConfig = TEXTURE_REGISTRY[textureType];
      if (!typeConfig) {
        throw new Error(`Unknown texture type: ${textureType}`);
      }

      const result = typeConfig.validate({
        ...uniforms,
        ...newUniforms,
      });

      if (!result.valid) {
        throw new Error(result.error);
      }

      // Update implementation
    },
    [textureType, uniforms, handles],
  );

  return {
    updateTexture,
    // Other utilities
  };
}
```

### Node Component Integration

```typescript
// packages/webgl/src/components/TextureNode.tsx
export interface TextureNodeProps {
  id: string;
  type: string;
  initialUniforms?: Record<string, UniformValue>;
}

export function TextureNode({ id, type, initialUniforms }: TextureNodeProps) {
  const handles = useTextureHandles(type);
  const { updateTexture } = useTextureUpdate({
    nodeId: id,
    textureType: type,
    uniforms: initialUniforms ?? {},
    handles,
  });

  // Component implementation
}
```

## Implementation Guidelines

1. **Type Safety**

   - Strict TypeScript usage
   - Proper type guards
   - Handle validation
   - Uniform validation

2. **Resource Management**

   - Efficient updates
   - Proper cleanup
   - Memory management
   - Cache invalidation

3. **Performance**

   - Minimal updates
   - Smart caching
   - Resource pooling
   - Batch processing

4. **Error Handling**
   - Clear messages
   - Type validation
   - Recovery options
   - Debug support

## Success Criteria

1. **Type Safety**

   - No type errors
   - Clear boundaries
   - Handle validation
   - Documentation

2. **Update System**

   - Consistent behavior
   - Resource cleanup
   - Error handling
   - Performance

3. **Integration**

   - Clean boundaries
   - No circular deps
   - Clear interfaces
   - Easy to use

4. **Performance**
   - Fast updates
   - Minimal overhead
   - Smart caching
   - Resource efficiency

## Testing Requirements

1. **Unit Tests**

   - Type validation
   - Update logic
   - Error cases
   - Performance

2. **Integration Tests**

   - Handle system
   - Node components
   - Resource management
   - Error handling

3. **Performance Tests**
   - Update speed
   - Memory usage
   - Cache efficiency
   - Resource usage

## Documentation Requirements

1. **Type Documentation**

   - Registry types
   - Handle types
   - Uniform types
   - Validation rules

2. **Architecture Documentation**

   - Update flow
   - Type safety
   - Error handling
   - Performance tips

3. **API Documentation**
   - Public interfaces
   - Hook usage
   - Error codes
   - Debug tools
