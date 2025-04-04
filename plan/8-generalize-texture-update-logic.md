# Generalize Texture Update Logic

## Overview

Create a unified texture update system that handles all texture types, expression evaluation, and shader management in a type-safe and performant way. This will consolidate the existing texture update hooks into a single, configurable system.

## Current State

- Multiple texture update hooks with duplicated logic
- Separate expression handling
- Inconsistent shader configuration
- Duplicated connection management
- Similar caching strategies across hooks
- Existing registry system in `@repo/webgl/registry/texture-registry.ts`
- Type definitions in `@repo/webgl/types/`

## Goals

1. Create a unified texture update system
2. Maintain type safety and validation
3. Support complex uniform types (vectors, expressions)
4. Improve shader resource management
5. Enhance performance through better caching
6. Support all current texture types
7. Make it easy to add new texture types

## Implementation Steps

### 1. Enhance Existing Types

```typescript
// packages/webgl/src/types/texture-registry.ts
import type { TextureFieldMetadata } from "./field";
import type { TextureHandle } from "./handle";
import type { TextureUniform } from "./texture-uniform";

// Extend existing TextureRegistryEntry
export interface TextureRegistryEntry {
  type: string;
  description: string;
  // From existing registry
  handles: TextureHandle[];
  defaultUniforms: Record<string, TextureUniform>;
  inputs: TextureFieldMetadata[];
  validateConnection: (handle: TextureHandle, sourceType: string) => boolean;
  // New additions
  uniformConfigs: Record<string, UniformConfig>;
  fragmentShader: string;
  vertexShader: string;
}

// New types for enhanced functionality
export interface UniformConfig {
  type: "texture" | "number" | "vec2" | "vec3" | "vec4" | "boolean";
  defaultValue: any;
  isExpression?: boolean;
  min?: number;
  max?: number;
  vectorComponents?: string[];
}

// packages/webgl/src/types/expression.ts
export interface ExpressionConfig {
  isExpression: boolean;
  defaultValue: number;
  min?: number;
  max?: number;
}

export interface UniformExpressionMap {
  [uniformName: string]: {
    pathToValue: string;
    config: ExpressionConfig;
  };
}
```

### 2. Enhanced Registry Integration

```typescript
// packages/webgl/src/registry/texture-registry.ts
import {
  TextureHandle,
  createTextureHandle,
  isValidTextureHandleForType
} from "../types/handle";
import {
  createTextureUniform,
  TextureUniform
} from "../types/texture-uniform";
import { addFragmentShader } from "../shaders/add";
import { baseVertexShader } from "../shaders/base-vert-shader";

export const TEXTURE_TYPE_REGISTRY: Record<string, TextureRegistryEntry> = {
  Add: {
    type: "Add",
    description: AddDescription,
    // Reuse existing handles
    handles: [
      createTextureHandle("input-1", "u_texture1"),
      createTextureHandle("input-2", "u_texture2")
    ],
    // Reuse existing uniforms
    defaultUniforms: {
      u_texture1: createTextureUniform(null, null),
      u_texture2: createTextureUniform(null, null)
    },
    // New uniform configs
    uniformConfigs: {
      u_addValue: {
        type: "number",
        defaultValue: 0.0,
        isExpression: true,
        min: -1.0,
        max: 1.0
      },
      u_enableMirror: {
        type: "boolean",
        defaultValue: false
      }
    },
    // Reuse existing validation
    validateConnection: (handle, sourceType) => true,
    // Add shader references
    fragmentShader: addFragmentShader,
    vertexShader: baseVertexShader
  }
};

// Preserve existing utility functions
export {
  getTextureInputsForType,
  isValidTextureHandleForType,
  isRequiredTextureHandle,
  getTextureHandles,
  getDefaultTextureUniforms
};
```

### 3. Unified Update Hook

```typescript
// apps/app/src/app/(app)/(workspace)/workspace/hooks/use-update-texture.ts
import {
  getTextureHandles,
  isValidTextureHandleForType,
  TEXTURE_TYPE_REGISTRY,
  TextureRegistryEntry,
} from "@repo/webgl/registry/texture-registry";
import { TextureHandle } from "@repo/webgl/types/handle";
import { TextureUniform } from "@repo/webgl/types/texture-uniform";

export function useUpdateTexture(textureType: string) {
  const connectionCache = useConnectionCache();
  const { targets } = useTextureRenderStore();
  const { evaluate } = useExpressionEvaluator();

  // Caches
  const shaderCache = useRef<Record<string, THREE.ShaderMaterial>>({});
  const expressionsRef = useRef<Record<string, Record<string, string>>>({});

  const updateTextureUniforms = useCallback(
    (shader: THREE.ShaderMaterial, nodeId: string, state: WebGLRootState) => {
      const config = TEXTURE_TYPE_REGISTRY[textureType];
      if (!config) return;

      // Update texture uniforms using existing registry functions
      config.handles.forEach((handle) => {
        if (!isValidTextureHandleForType(textureType, handle)) return;

        const sourceId = connectionCache.current[nodeId]?.[handle.id];
        if (sourceId && !config.validateConnection(handle, sourceId)) {
          console.warn(`Invalid connection for handle ${handle.id}`);
          return;
        }

        const textureObject = sourceId ? targets[sourceId]?.texture : null;
        if (shader.uniforms[handle.uniformName]) {
          shader.uniforms[handle.uniformName].value = textureObject;
        }
      });

      // Update expression-based uniforms
      Object.entries(config.uniformConfigs).forEach(
        ([uniformName, uniformConfig]) => {
          if (!uniformConfig.isExpression) return;
          // Handle expression updates using evaluate
        },
      );
    },
    [textureType, connectionCache, targets, evaluate],
  );

  return {
    updateTextureUniforms,
    shaderCache,
    expressionsRef,
  };
}
```

### 4. Pipeline Integration

```typescript
// apps/app/src/app/(app)/(workspace)/workspace/components/webgl/webgl-texture-render-pipeline.tsx
export const WebGLTextureRenderPipeline = () => {
  const { targets } = useTextureRenderStore();
  const textureDataMap = useTextureDataMap();

  const nodes = useMemo(() => {
    return Object.entries(textureDataMap).map(([id, texture]) => {
      const { updateTextureUniforms, shaderCache } = useUpdateTexture(texture.type);

      return {
        id,
        shader: shaderCache.current[id],
        onEachFrame: (state: WebGLRootState) => {
          updateTextureUniforms(shaderCache.current[id], id, state);
        }
      };
    });
  }, [textureDataMap]);

  return <TextureRenderPipeline targets={targets} nodes={nodes} />;
};
```

## Implementation Phases

### Phase 1: Core Infrastructure (Days 1-2)

1. Create enhanced type definitions
2. Set up texture registry
3. Implement expression system types
4. Add validation utilities

### Phase 2: Hook Implementation (Days 3-4)

1. Create base hook structure
2. Implement connection management
3. Add expression handling
4. Set up uniform updates
5. Add caching system

### Phase 3: Integration (Days 5-6)

1. Update pipeline component
2. Migrate one texture type
3. Test and validate
4. Migrate remaining types
5. Clean up old implementations

### Phase 4: Testing and Optimization (Days 7-8)

1. Add unit tests
2. Add integration tests
3. Performance testing
4. Memory leak checks
5. Documentation

## Testing Strategy

### Unit Tests

1. Registry validation
2. Expression evaluation
3. Uniform updates
4. Connection management
5. Type validation

### Integration Tests

1. Full pipeline flow
2. Multiple texture types
3. Expression handling
4. Resource cleanup
5. Error conditions

### Performance Tests

1. Memory usage
2. Render performance
3. Cache effectiveness
4. Resource management
5. Expression evaluation speed

## Success Criteria

1. All texture types working with new system
2. No performance regression
3. Improved code maintainability
4. Complete test coverage
5. No memory leaks
6. Clear documentation
7. Type safety maintained

## Migration Strategy

1. **Preparation**

   - Set up new infrastructure
   - Create test environment
   - Document existing behavior

2. **Implementation**

   - Build core functionality
   - Add type support
   - Implement caching
   - Add validation

3. **Migration**

   - Start with Add texture
   - Validate functionality
   - Migrate other types
   - Remove old code

4. **Validation**
   - Run test suite
   - Check performance
   - Validate types
   - Document changes

## Future Considerations

1. **Performance**

   - Shader compilation optimization
   - Expression evaluation caching
   - Uniform update batching
   - Memory usage optimization

2. **Features**

   - New texture types
   - Enhanced expressions
   - Advanced validation
   - Debug tooling

3. **Maintenance**
   - Documentation updates
   - Performance monitoring
   - Type safety improvements
   - Testing automation
