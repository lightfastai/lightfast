# Phase 6: WebGL Registry and Handle Integration

## Overview

This phase updates the WebGL registry to work with the new handle type system, implementing proper type safety and validation while maintaining clean architectural boundaries between WebGL and DB layers.

## Requirements

### WebGL Registry Updates

1. **Registry Structure**

   - Define type-safe registry interface
   - Support handle-based texture configuration
   - Implement validation rules
   - Maintain backward compatibility

2. **Handle Integration**

   - Map handles to uniforms
   - Support texture validation
   - Handle type checking
   - Proper error handling

3. **Uniform Management**
   - Type-safe uniform configuration
   - Support for complex uniforms
   - Expression handling
   - Resource cleanup

### Type Definitions

```typescript
// packages/webgl/src/types/registry.ts
export interface TextureFieldMetadata {
  handle: TextureHandle;
  isRequired: boolean;
  defaultValue: any;
}

export interface TextureRegistryEntry {
  fields: Record<string, TextureFieldMetadata>;
  validateConnection: (handle: TextureHandle, sourceType: string) => boolean;
  createDefaultUniforms: () => Record<string, TextureUniform>;
}

export interface TextureRegistry {
  [textureType: string]: TextureRegistryEntry;
}
```

### Registry Implementation

```typescript
// packages/webgl/src/registry/texture-registry.ts
export const TEXTURE_REGISTRY: TextureRegistry = {
  add: {
    fields: {
      input1: {
        handle: { id: "input1", uniformName: "u_texture1", type: "texture" },
        isRequired: true,
        defaultValue: null,
      },
      input2: {
        handle: { id: "input2", uniformName: "u_texture2", type: "texture" },
        isRequired: true,
        defaultValue: null,
      },
    },
    validateConnection: (handle, sourceType) => {
      // Add-specific validation logic
      return true;
    },
    createDefaultUniforms: () => ({
      u_texture1: createTextureUniform(null, null),
      u_texture2: createTextureUniform(null, null),
    }),
  },
  // Other texture types...
};
```

### Validation Functions

```typescript
// packages/webgl/src/validation/texture-validation.ts
export function validateTextureConnection(
  handle: TextureHandle,
  sourceType: string,
  textureType: string,
): ValidationResult {
  const entry = TEXTURE_REGISTRY[textureType];
  if (!entry) {
    return {
      valid: false,
      error: `Unknown texture type: ${textureType}`,
    };
  }

  const field = Object.values(entry.fields).find(
    (f) => f.handle.id === handle.id,
  );
  if (!field) {
    return {
      valid: false,
      error: `Unknown handle: ${handle.id}`,
    };
  }

  if (!entry.validateConnection(handle, sourceType)) {
    return {
      valid: false,
      error: `Invalid connection for ${textureType}`,
    };
  }

  return { valid: true };
}
```

## Implementation Guidelines

1. **Type Safety**

   - Use strict TypeScript typing
   - Implement proper type guards
   - Validate at compile time
   - Runtime type checking

2. **Validation**

   - Clear validation rules
   - Proper error messages
   - Type-safe validation
   - Performance optimization

3. **Resource Management**

   - Proper cleanup
   - Memory management
   - Resource pooling
   - Cache invalidation

4. **Architecture**
   - Clean boundaries
   - No circular deps
   - Clear interfaces
   - Proper abstraction

## Success Criteria

1. **Registry Updates**

   - Type-safe registry
   - Handle integration
   - Validation rules
   - Clean architecture

2. **Handle System**

   - Type safety
   - Validation
   - Error handling
   - Performance

3. **Uniform Management**

   - Type safety
   - Resource cleanup
   - Expression support
   - Caching

4. **Integration**
   - Clean boundaries
   - No circular deps
   - Clear interfaces
   - Performance

## Testing Requirements

1. **Registry Tests**

   - Type validation
   - Handle validation
   - Uniform creation
   - Error cases

2. **Integration Tests**

   - Handle system
   - Validation rules
   - Resource management
   - Performance

3. **Edge Cases**
   - Invalid types
   - Missing handles
   - Resource cleanup
   - Error handling

## Documentation Requirements

1. **Registry Documentation**

   - Type definitions
   - Validation rules
   - Usage examples
   - Best practices

2. **Architecture Documentation**

   - Layer boundaries
   - Dependencies
   - Design decisions
   - Migration guide

3. **API Documentation**
   - Public interfaces
   - Type definitions
   - Validation rules
   - Error handling
