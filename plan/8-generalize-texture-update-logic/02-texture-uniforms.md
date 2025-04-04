# Phase 2: Texture Uniform Handling

## Overview

Implement a generalized system for handling texture uniforms with connection validation and caching.

## Implementation

### 1. Texture Handle Types

```typescript
// packages/webgl/src/types/texture-handle.ts
import type { TextureUniform } from "./texture-uniform";

export interface TextureHandleConfig {
  id: string;
  uniformName: string;
  required?: boolean;
  description?: string;
  allowedTypes?: string[];
}

export interface TextureConnection {
  sourceId: string | null;
  targetId: string;
  handleId: string;
  textureObject: THREE.Texture | null;
}

export interface TextureConnectionCache {
  [nodeId: string]: {
    [handleId: string]: TextureConnection;
  };
}
```

### 2. Connection Management

```typescript
// packages/webgl/src/utils/connection-manager.ts
import type {
  TextureConnection,
  TextureConnectionCache,
} from "../types/texture-handle";
import type { TextureRegistryEntry } from "../types/texture-registry";

export class ConnectionManager {
  private cache: TextureConnectionCache = {};

  updateConnection(
    targetId: string,
    handleId: string,
    sourceId: string | null,
    textureObject: THREE.Texture | null,
  ): void {
    if (!this.cache[targetId]) {
      this.cache[targetId] = {};
    }

    this.cache[targetId][handleId] = {
      sourceId,
      targetId,
      handleId,
      textureObject,
    };
  }

  validateConnection(
    config: TextureRegistryEntry,
    handleId: string,
    sourceType: string | null,
  ): boolean {
    const handle = config.handles.find((h) => h.id === handleId);
    if (!handle) return false;

    if (!sourceType) {
      return !handle.required;
    }

    return config.validateConnection(handle, sourceType);
  }

  getConnection(targetId: string, handleId: string): TextureConnection | null {
    return this.cache[targetId]?.[handleId] || null;
  }

  clearConnections(nodeId: string): void {
    delete this.cache[nodeId];
  }
}
```

### 3. Texture Uniform Updates

```typescript
// packages/webgl/src/utils/texture-updates.ts
import type { ShaderMaterial } from "three";

import type { TextureRegistryEntry } from "../types/texture-registry";
import type { ConnectionManager } from "./connection-manager";

export function updateTextureUniforms(
  shader: ShaderMaterial,
  nodeId: string,
  config: TextureRegistryEntry,
  connectionManager: ConnectionManager,
): void {
  config.handles.forEach((handle) => {
    const connection = connectionManager.getConnection(nodeId, handle.id);
    if (!connection) {
      if (shader.uniforms[handle.uniformName]) {
        shader.uniforms[handle.uniformName].value = null;
      }
      return;
    }

    if (shader.uniforms[handle.uniformName]) {
      shader.uniforms[handle.uniformName].value = connection.textureObject;
    }
  });
}
```

### 4. Integration with Update Hook

```typescript
// apps/app/src/app/(app)/(workspace)/workspace/hooks/use-update-texture.ts
export function useUpdateTexture(textureType: string) {
  const connectionManager = useRef(new ConnectionManager()).current;
  const { targets } = useTextureRenderStore();
  const { edges } = useEdgeStore();

  // Update connections when edges change
  useEffect(() => {
    edges.forEach((edge) => {
      const sourceId = edge.source;
      const targetId = edge.target;
      const handleId = edge.targetHandle;

      if (!handleId) return;

      const textureObject = targets[sourceId]?.texture || null;
      connectionManager.updateConnection(
        targetId,
        handleId,
        sourceId,
        textureObject,
      );
    });
  }, [edges, targets]);

  const updateTextureUniforms = useCallback(
    (shader: THREE.ShaderMaterial, nodeId: string) => {
      const config = TEXTURE_TYPE_REGISTRY[textureType];
      if (!config) return;

      updateTextureUniforms(shader, nodeId, config, connectionManager);
    },
    [textureType],
  );

  // Rest of the hook implementation...
}
```

### 5. Example Usage

```typescript
// Example configuration for Add texture
const AddConfig: TextureRegistryEntry = {
  type: "Add",
  handles: [
    {
      id: "input1",
      uniformName: "u_texture1",
      required: true,
      description: "First input texture",
    },
    {
      id: "input2",
      uniformName: "u_texture2",
      required: true,
      description: "Second input texture",
    },
  ],
  validateConnection: (handle, sourceType) => true,
  // ... other config
};
```

## Migration Steps

1. **Update Types**

   - Implement texture handle types
   - Create connection types
   - Update registry types

2. **Implement Core Functionality**

   - Create connection manager
   - Implement texture updates
   - Add validation system

3. **Integration**

   - Update texture registry
   - Enhance update hook
   - Add migration utilities

4. **Testing**
   - Unit tests for connection management
   - Validation tests
   - Integration tests

## Validation

1. **Type Safety**

   - Ensure all texture updates are type-safe
   - Validate connections
   - Check handle management

2. **Performance**

   - Monitor connection updates
   - Check texture update efficiency
   - Validate caching strategy

3. **Error Handling**
   - Invalid connection handling
   - Missing texture handling
   - Type mismatch handling
