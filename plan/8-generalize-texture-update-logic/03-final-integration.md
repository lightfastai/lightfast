# Phase 3: Final Integration

## Overview

Integrate the non-texture uniform system and texture uniform system into a unified update hook, with proper type safety and performance optimizations.

## Implementation

### 1. Combined Update Hook

```typescript
// apps/app/src/app/(app)/(workspace)/workspace/hooks/use-update-texture.ts
import type { ShaderMaterial } from "three";

import type { WebGLRootState } from "@repo/webgl/types";
import { TEXTURE_TYPE_REGISTRY } from "@repo/webgl/registry/texture-registry";

import { ConnectionManager } from "../utils/connection-manager";
import { updateTextureUniforms } from "../utils/texture-updates";
import { updateNonTextureUniforms } from "../utils/uniform-updates";

export function useUpdateTexture(textureType: string) {
  // Managers and caches
  const connectionManager = useRef(new ConnectionManager()).current;
  const shaderCache = useRef<Record<string, ShaderMaterial>>({});
  const expressionsRef = useRef<Record<string, UniformExpressionMap>>({});

  // Store dependencies
  const { targets } = useTextureRenderStore();
  const { edges } = useEdgeStore();
  const { evaluate, getTimeContext } = useExpressionEvaluator();

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

  // Main update function
  const updateUniforms = useCallback(
    (shader: ShaderMaterial, nodeId: string, state: WebGLRootState) => {
      const config = TEXTURE_TYPE_REGISTRY[textureType];
      if (!config) return;

      // Update texture uniforms
      updateTextureUniforms(shader, nodeId, config, connectionManager);

      // Update non-texture uniforms
      updateNonTextureUniforms(
        shader,
        nodeId,
        config,
        expressionsRef.current[nodeId],
        getTimeContext(state),
      );
    },
    [textureType, getTimeContext],
  );

  // Initialize shader and expressions
  const initializeNode = useCallback(
    (nodeId: string, textureData: TextureData) => {
      const config = TEXTURE_TYPE_REGISTRY[textureType];
      if (!config) return;

      // Create shader if not exists
      if (!shaderCache.current[nodeId]) {
        shaderCache.current[nodeId] = new ShaderMaterial({
          vertexShader: config.vertexShader,
          fragmentShader: config.fragmentShader,
          uniforms: createInitialUniforms(config, textureData),
        });
      }

      // Initialize expressions
      expressionsRef.current[nodeId] = createExpressionMap(
        config,
        textureData.uniforms,
      );
    },
    [textureType],
  );

  // Cleanup
  const cleanup = useCallback((nodeId: string) => {
    const shader = shaderCache.current[nodeId];
    if (shader) {
      Object.values(shader.uniforms).forEach((uniform) => {
        if (uniform.value instanceof THREE.Texture) {
          uniform.value.dispose();
        }
      });
      shader.dispose();
      delete shaderCache.current[nodeId];
    }

    connectionManager.clearConnections(nodeId);
    delete expressionsRef.current[nodeId];
  }, []);

  return {
    updateUniforms,
    initializeNode,
    cleanup,
    shaderCache: shaderCache.current,
  };
}
```

### 2. Pipeline Integration

```typescript
// apps/app/src/app/(app)/(workspace)/workspace/components/webgl/webgl-texture-render-pipeline.tsx
export const WebGLTextureRenderPipeline = () => {
  const { targets } = useTextureRenderStore();
  const textureDataMap = useTextureDataMap();

  const nodes = useMemo(() => {
    return Object.entries(textureDataMap).map(([id, textureData]) => {
      const {
        updateUniforms,
        initializeNode,
        cleanup,
        shaderCache
      } = useUpdateTexture(textureData.type);

      // Initialize node
      useEffect(() => {
        initializeNode(id, textureData);
        return () => cleanup(id);
      }, [id, textureData]);

      return {
        id,
        shader: shaderCache[id],
        onEachFrame: (state: WebGLRootState) => {
          updateUniforms(shaderCache[id], id, state);
        }
      };
    });
  }, [textureDataMap]);

  return <TextureRenderPipeline targets={targets} nodes={nodes} />;
};
```

### 3. Helper Functions

```typescript
// packages/webgl/src/utils/shader-helpers.ts
import type { TextureData } from "../types/texture-data";
import type { TextureRegistryEntry } from "../types/texture-registry";

export function createInitialUniforms(
  config: TextureRegistryEntry,
  textureData: TextureData,
) {
  const uniforms: Record<string, any> = {};

  // Initialize texture uniforms
  config.handles.forEach((handle) => {
    uniforms[handle.uniformName] = { value: null };
  });

  // Initialize non-texture uniforms
  Object.entries(config.uniformConfigs).forEach(([name, config]) => {
    switch (config.type) {
      case "number":
      case "boolean":
        uniforms[name] = {
          value: textureData.uniforms[name] ?? config.defaultValue,
        };
        break;
      case "vec2":
      case "vec3":
      case "vec4":
        uniforms[name] = {
          value: new THREE.Vector2(
            ...config.vectorComponents.map(
              (c) => textureData.uniforms[name]?.[c] ?? config.defaultValue[c],
            ),
          ),
        };
        break;
    }
  });

  return uniforms;
}

export function createExpressionMap(
  config: TextureRegistryEntry,
  uniforms: Record<string, any>,
): UniformExpressionMap {
  const expressionMap: UniformExpressionMap = {};

  Object.entries(config.uniformConfigs).forEach(([name, config]) => {
    if (!config.isExpression) return;

    if (config.type === "number" || config.type === "boolean") {
      const value = uniforms[name];
      if (isExpression(value)) {
        expressionMap[name] = {
          expression: value,
          config: { uniformName: name, type: config.type },
        };
      }
    } else if (["vec2", "vec3", "vec4"].includes(config.type)) {
      config.vectorComponents.forEach((component) => {
        const value = uniforms[name]?.[component];
        if (isExpression(value)) {
          expressionMap[`${name}.${component}`] = {
            expression: value,
            config: {
              uniformName: name,
              type: config.type,
              pathToValue: `value.${component}`,
              vectorComponents: config.vectorComponents,
            },
          };
        }
      });
    }
  });

  return expressionMap;
}
```

## Migration Steps

1. **Integration Setup**

   - Combine non-texture and texture systems
   - Set up unified hook structure
   - Create helper functions

2. **Pipeline Updates**

   - Update render pipeline
   - Add initialization logic
   - Implement cleanup

3. **Testing**
   - End-to-end tests
   - Performance tests
   - Memory leak tests

## Validation

1. **Functionality**

   - All uniform types working
   - Proper initialization
   - Correct cleanup

2. **Performance**

   - Efficient updates
   - Proper caching
   - Memory management

3. **Type Safety**
   - Complete type coverage
   - Runtime validation
   - Error handling

## Next Steps

1. **Documentation**

   - API documentation
   - Usage examples
   - Migration guide

2. **Optimization**

   - Performance profiling
   - Memory optimization
   - Cache improvements

3. **Future Features**
   - New uniform types
   - Enhanced validation
   - Debug tools
