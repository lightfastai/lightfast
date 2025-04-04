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

### Proposed Unified Architecture

#### 1. Create a Generic Texture Configuration Registry

```typescript
// packages/webgl/src/types/texture-registry.ts

export interface TextureTypeConfig {
  fragmentShader: string;
  uniformConfig: {
    [uniformName: string]: {
      type: "texture" | "number" | "boolean" | "vec2";
      defaultValue: any;
      isExpression?: boolean;
      vectorComponents?: ("x" | "y")[];
    };
  };
  handles: Array<{
    id: string;
    uniformName: string;
    description: string;
    required: boolean;
  }>;
}

// Registry of texture type configurations
export const TEXTURE_TYPE_REGISTRY: Record<string, TextureTypeConfig> = {
  Add: {
    fragmentShader: addFragmentShader,
    uniformConfig: {
      u_texture1: { type: "texture", defaultValue: null },
      u_texture2: { type: "texture", defaultValue: null },
      u_addValue: { type: "number", defaultValue: 0.0, isExpression: true },
      u_enableMirror: { type: "boolean", defaultValue: false },
    },
    handles: [
      {
        id: "input-1",
        uniformName: "u_texture1",
        description: "First texture",
        required: true,
      },
      {
        id: "input-2",
        uniformName: "u_texture2",
        description: "Second texture",
        required: true,
      },
    ],
  },
  // Similarly for other texture types...
};
```

#### 2. Create a Unified Texture Update Hook

```typescript
// apps/app/src/app/(app)/(workspace)/workspace/hooks/use-update-texture.ts

export const useUpdateTexture = ({
  textureDataMap,
}: {
  textureDataMap: Record<string, Texture>;
}): WebGLRenderTargetNode[] => {
  const { targets } = useTextureRenderStore((state) => state);
  const { edges } = useEdgeStore((state) => state);

  // Shared caches
  const shaderCache = useRef<Record<string, THREE.ShaderMaterial>>({});
  const connectionCache = useRef<Record<string, Record<string, string | null>>>(
    {},
  );
  const expressionsRef = useRef<Record<string, Record<string, string>>>({});

  // Use the shared expression evaluator
  const { updateShaderUniforms } = useExpressionEvaluator();

  // Update connection cache when edges change
  useEffect(() => {
    // Initialize connections for each node
    Object.keys(targets).forEach((nodeId) => {
      if (!connectionCache.current[nodeId]) {
        connectionCache.current[nodeId] = {};
      }
    });

    // Process edges to map connections to input handles
    edges.forEach((edge) => {
      const targetId = edge.target;
      const sourceId = edge.source;
      const handleId = edge.targetHandle || "input-1";

      if (connectionCache.current[targetId]) {
        connectionCache.current[targetId][handleId] = sourceId;
      }
    });
  }, [edges, targets]);

  // Create render nodes
  return useMemo(() => {
    return Object.entries(textureDataMap)
      .map(([id, texture]) => {
        // Get configuration for this texture type
        const config = TEXTURE_TYPE_REGISTRY[texture.type];
        if (!config) return null;

        const { uniforms: u } = texture;

        // Ensure expressions cache exists for this ID
        expressionsRef.current[id] = expressionsRef.current[id] || {};

        // Store expressions for this node based on config
        Object.entries(config.uniformConfig).forEach(
          ([uniformName, uniformConfig]) => {
            if (uniformConfig.isExpression && u[uniformName]) {
              if (
                uniformConfig.type === "vec2" &&
                uniformConfig.vectorComponents
              ) {
                // Handle vector components
                uniformConfig.vectorComponents.forEach((component) => {
                  const key = `${uniformName}.${component}`;
                  const value = u[uniformName]?.[component];
                  if (isExpression(value)) {
                    expressionsRef.current[id]![key] = value;
                  }
                });
              } else {
                // Handle scalar values
                if (isExpression(u[uniformName])) {
                  expressionsRef.current[id]![uniformName] = u[uniformName];
                }
              }
            }
          },
        );

        // Create or reuse shader
        if (!shaderCache.current[id]) {
          // Initialize uniforms based on config
          const uniforms: Record<string, any> = {};

          Object.entries(config.uniformConfig).forEach(
            ([uniformName, uniformConfig]) => {
              switch (uniformConfig.type) {
                case "texture":
                  uniforms[uniformName] = { value: null };
                  break;
                case "number":
                  uniforms[uniformName] = {
                    value:
                      typeof u[uniformName] === "number"
                        ? u[uniformName]
                        : uniformConfig.defaultValue,
                  };
                  break;
                case "boolean":
                  uniforms[uniformName] = {
                    value: Boolean(u[uniformName]),
                  };
                  break;
                case "vec2":
                  const x =
                    typeof u[uniformName]?.x === "number"
                      ? u[uniformName].x
                      : uniformConfig.defaultValue.x;
                  const y =
                    typeof u[uniformName]?.y === "number"
                      ? u[uniformName].y
                      : uniformConfig.defaultValue.y;
                  uniforms[uniformName] = { value: new THREE.Vector2(x, y) };
                  break;
              }
            },
          );

          // Create the shader
          shaderCache.current[id] = new THREE.ShaderMaterial({
            vertexShader: baseVertexShader,
            fragmentShader: config.fragmentShader,
            uniforms,
          });
        }

        // Get cached shader
        const shader = shaderCache.current[id];

        // Update uniform values
        Object.entries(config.uniformConfig).forEach(
          ([uniformName, uniformConfig]) => {
            if (uniformConfig.type === "texture") {
              // Texture uniforms are updated in onEachFrame
              return;
            }

            // Update non-texture uniforms if they exist
            if (shader.uniforms[uniformName]) {
              switch (uniformConfig.type) {
                case "number":
                  if (typeof u[uniformName] === "number") {
                    shader.uniforms[uniformName].value = u[uniformName];
                  }
                  break;
                case "boolean":
                  shader.uniforms[uniformName].value = Boolean(u[uniformName]);
                  break;
                case "vec2":
                  if (u[uniformName]) {
                    const x =
                      typeof u[uniformName].x === "number"
                        ? u[uniformName].x
                        : uniformConfig.defaultValue.x;
                    const y =
                      typeof u[uniformName].y === "number"
                        ? u[uniformName].y
                        : uniformConfig.defaultValue.y;
                    shader.uniforms[uniformName].value.set(x, y);
                  }
                  break;
              }
            }
          },
        );

        return {
          id,
          shader,
          onEachFrame: (state: WebGLRootState) => {
            // Get expressions for this node
            const expressions = expressionsRef.current[id] || {};

            // Build uniform path map based on config
            const uniformPathMap: Record<string, { pathToValue: string }> = {};

            Object.entries(config.uniformConfig).forEach(
              ([uniformName, uniformConfig]) => {
                if (uniformConfig.isExpression) {
                  if (
                    uniformConfig.type === "vec2" &&
                    uniformConfig.vectorComponents
                  ) {
                    uniformConfig.vectorComponents.forEach((component) => {
                      uniformPathMap[`${uniformName}.${component}`] = {
                        pathToValue: `${uniformName}.value.${component}`,
                      };
                    });
                  } else {
                    uniformPathMap[uniformName] = {
                      pathToValue: `${uniformName}.value`,
                    };
                  }
                }
              },
            );

            // Update texture uniforms based on connections
            const nodeConnections = connectionCache.current[id] || {};

            config.handles.forEach((handle) => {
              const sourceId = nodeConnections[handle.id];
              if (shader.uniforms[handle.uniformName]) {
                shader.uniforms[handle.uniformName].value = sourceId
                  ? targets[sourceId]?.texture
                  : null;

                // Update the TextureUniform in the node data if present
                if (isTextureUniform(u[handle.uniformName])) {
                  (u[handle.uniformName] as any) = updateTextureUniform(
                    u[handle.uniformName] as any,
                    sourceId,
                    sourceId ? targets[sourceId]?.texture : null,
                  );
                }
              }
            });

            // Use the shared uniform update utility
            updateShaderUniforms(state, shader, expressions, uniformPathMap);
          },
        };
      })
      .filter(Boolean) as WebGLRenderTargetNode[];
  }, [textureDataMap, targets, updateShaderUniforms]);
};
```

## Folder Structure Reorganization

Reorganize the `7-strict-compile-time-connection-flow` folder into:

```
/plan/7-strict-compile-time-connection-flow/
  /current-architecture/
    - edge-architecture.md
    - data-flow-diagram.md
    - connection-type-diagram.md
  /new-architecture/
    - implementation-plan.md
    - future-considerations.md
    - rethinking-texture-uniform.md
    - unified-texture-update.md
    - new-architecture-diagram.md
```

## Benefits of New Architecture

1. **Maintainability**: Single point of change for all texture types
2. **Extensibility**: Adding a new texture type just requires adding to the registry
3. **Type Safety**: More explicit type definitions for uniforms
4. **Consistency**: Unified approach to texture updates across all types
5. **Separation of Concerns**: Clear distinction between configuration and runtime logic
6. **Code Reuse**: No duplication of common logic across different texture types
7. **Performance**: Same caching strategies but applied more consistently

## Migration Strategy

1. Create the unified texture registry
2. Implement the unified update hook
3. Test with one texture type
4. Gradually migrate each texture type
5. Update components to use the new hook
6. Remove the old hooks once migration is complete
