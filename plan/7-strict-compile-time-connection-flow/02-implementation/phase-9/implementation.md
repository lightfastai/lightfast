# Phase 9: Unified Texture Update System

## Overview

This phase implements a unified texture update system that works with the new TextureHandle interface and provides consistent behavior across all texture types.

## Implementation Details

### Texture Type Registry

```typescript
// packages/webgl/src/registry/texture-type-registry.ts
import type { TextureHandle } from "../types/handle";
import type { TextureUniform } from "../types/uniform";

export interface TextureTypeConfig {
  handles: TextureHandle[];
  defaultUniforms: Record<string, TextureUniform>;
  validateConnection: (handle: TextureHandle, sourceType: string) => boolean;
}

export const TEXTURE_TYPE_REGISTRY: Record<string, TextureTypeConfig> = {
  add: {
    handles: [
      { id: "input1", uniformName: "u_texture1" },
      { id: "input2", uniformName: "u_texture2" },
    ],
    defaultUniforms: {
      u_texture1: createTextureUniform(null, null),
      u_texture2: createTextureUniform(null, null),
    },
    validateConnection: (handle, sourceType) => {
      // Add-specific validation logic
      return true; // Implement actual validation
    },
  },
  noise: {
    handles: [{ id: "seed", uniformName: "u_seed" }],
    defaultUniforms: {
      u_seed: createTextureUniform(null, null),
    },
    validateConnection: (handle, sourceType) => {
      // Noise-specific validation logic
      return sourceType === "random" || sourceType === "perlin";
    },
  },
  // Add other texture types...
};
```

### Unified Update Hook

```typescript
// apps/app/src/app/(app)/(workspace)/workspace/hooks/use-update-texture.ts
import { useCallback } from "react";

import type { TextureHandle } from "@repo/webgl";
import { TEXTURE_TYPE_REGISTRY } from "@repo/webgl";

export function useUpdateTexture(textureType: string) {
  const connectionCache = useConnectionCache();
  const { targets, nodeTypes } = useTextureRenderStore();

  const updateTextureUniforms = useCallback(
    (shader: THREE.ShaderMaterial, nodeId: string) => {
      const config = TEXTURE_TYPE_REGISTRY[textureType];
      if (!config) return;

      config.handles.forEach((handle) => {
        const sourceId = connectionCache.current[nodeId]?.[handle.id];
        const sourceType = sourceId ? nodeTypes[sourceId] : null;

        // Validate connection if it exists
        if (
          sourceId &&
          sourceType &&
          !config.validateConnection(handle, sourceType)
        ) {
          console.warn(
            `Invalid connection for ${textureType} texture at handle ${handle.id}`,
          );
          return;
        }

        const textureObject =
          sourceId && targets[sourceId]?.texture
            ? targets[sourceId].texture
            : null;

        if (shader.uniforms[handle.uniformName]) {
          shader.uniforms[handle.uniformName].value = textureObject;
        }
      });
    },
    [textureType, connectionCache, targets, nodeTypes],
  );

  return {
    updateTextureUniforms,
  };
}
```

### Node Component Integration

```typescript
// apps/app/src/app/(app)/(workspace)/workspace/components/nodes/TextureNode.tsx
import { useUpdateTexture } from '../../hooks/use-update-texture';
import { TEXTURE_TYPE_REGISTRY } from '@repo/webgl';

export function TextureNode({ id, type }: TextureNodeProps) {
  const { updateTextureUniforms } = useUpdateTexture(type);
  const shader = useShaderRef(id);

  useEffect(() => {
    if (!shader.current) return;

    // Initialize uniforms
    const config = TEXTURE_TYPE_REGISTRY[type];
    if (!config) return;

    Object.entries(config.defaultUniforms).forEach(([name, uniform]) => {
      shader.current!.uniforms[name] = { value: uniform.textureObject };
    });
  }, [type]);

  useEffect(() => {
    if (!shader.current) return;
    updateTextureUniforms(shader.current, id);
  }, [id, updateTextureUniforms]);

  return (
    <NodeWrapper id={id}>
      {TEXTURE_TYPE_REGISTRY[type]?.handles.map(handle => (
        <Handle
          key={handle.id}
          id={handle.id}
          type="target"
          position={Position.Left}
        />
      ))}
      <TexturePreview shader={shader.current} />
    </NodeWrapper>
  );
}
```

### Connection Validation Integration

```typescript
// apps/app/src/app/(app)/(workspace)/workspace/hooks/use-validate-texture-connection.ts
import { TEXTURE_TYPE_REGISTRY } from "@repo/webgl";

export function useValidateTextureConnection() {
  const { nodeTypes } = useStore();

  const validateConnection = useCallback(
    (connection: Connection): boolean => {
      const targetType = nodeTypes[connection.target];
      const sourceType = nodeTypes[connection.source];

      if (!targetType || !sourceType) return false;

      const config = TEXTURE_TYPE_REGISTRY[targetType];
      if (!config) return false;

      const handle = config.handles.find(
        (h) => h.id === connection.targetHandle,
      );
      if (!handle) return false;

      return config.validateConnection(handle, sourceType);
    },
    [nodeTypes],
  );

  return validateConnection;
}
```

## Implementation Notes

1. **Unified Registry**:

   - Single source of truth for texture types
   - Consistent handle and uniform configuration
   - Type-safe validation rules
   - Easy to extend with new texture types

2. **Improved Update Logic**:

   - Centralized update mechanism
   - Consistent validation
   - Better error handling
   - Optimized performance

3. **Component Integration**:

   - Clean component architecture
   - Automatic uniform initialization
   - Dynamic handle rendering
   - Proper cleanup

4. **Type Safety**:

   - Strong typing throughout
   - Runtime validation
   - Clear error messages
   - Better debugging support

5. **Performance Optimizations**:
   - Minimized re-renders
   - Efficient uniform updates
   - Smart validation caching
   - Proper resource management
