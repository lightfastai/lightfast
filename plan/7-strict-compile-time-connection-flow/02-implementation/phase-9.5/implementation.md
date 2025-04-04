# Phase 9.5: Expression System and Complex Uniform Integration

## Overview

This phase integrates the expression system and complex uniform handling with our new handle-based architecture, preserving important features from the original implementation while maintaining the clean architectural boundaries.

## Implementation Details

### Expression Types and Validation

```typescript
// packages/webgl/src/types/expression.ts
export type ExpressionValue = string | number;

export interface ExpressionConfig {
  isExpression: boolean;
  defaultValue: number;
  min?: number;
  max?: number;
}

export function isExpression(value: unknown): value is string {
  return typeof value === "string" && value.startsWith("$");
}

export interface UniformExpressionMap {
  [uniformName: string]: {
    pathToValue: string;
    config: ExpressionConfig;
  };
}
```

### Enhanced Texture Type Registry

```typescript
// packages/webgl/src/registry/texture-type-registry.ts
import type { ExpressionConfig } from "../types/expression";
import type { TextureHandle } from "../types/handle";
import type { TextureUniform } from "../types/uniform";

export interface UniformConfig {
  type: "texture" | "number" | "vec2" | "vec3" | "vec4";
  defaultValue: any;
  isExpression?: boolean;
  min?: number;
  max?: number;
  vectorComponents?: string[];
}

export interface TextureTypeConfig {
  handles: TextureHandle[];
  defaultUniforms: Record<string, TextureUniform>;
  uniformConfigs: Record<string, UniformConfig>;
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
    uniformConfigs: {
      u_addValue: {
        type: "number",
        defaultValue: 0.0,
        isExpression: true,
        min: -1.0,
        max: 1.0,
      },
      u_mixWeight: {
        type: "vec2",
        defaultValue: { x: 0.5, y: 0.5 },
        isExpression: true,
        vectorComponents: ["x", "y"],
      },
    },
    validateConnection: (handle, sourceType) => true,
  },
  // Other texture types...
};
```

### Enhanced Update Hook with Expression Support

```typescript
// apps/app/src/app/(app)/(workspace)/workspace/hooks/use-update-texture.ts
export function useUpdateTexture(textureType: string) {
  const connectionCache = useConnectionCache();
  const { targets, nodeTypes } = useTextureRenderStore();
  const { evaluate } = useExpressionEvaluator();

  // Cache for shader instances
  const shaderCache = useRef<Record<string, THREE.ShaderMaterial>>({});

  // Cache for expressions
  const expressionsRef = useRef<Record<string, Record<string, string>>>({});

  const updateTextureUniforms = useCallback(
    (shader: THREE.ShaderMaterial, nodeId: string, state: WebGLRootState) => {
      const config = TEXTURE_TYPE_REGISTRY[textureType];
      if (!config) return;

      // Update texture uniforms
      config.handles.forEach((handle) => {
        const sourceId = connectionCache.current[nodeId]?.[handle.id];
        const sourceType = sourceId ? nodeTypes[sourceId] : null;

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

      // Update expression-based uniforms
      Object.entries(config.uniformConfigs).forEach(
        ([uniformName, uniformConfig]) => {
          if (!uniformConfig.isExpression) return;

          const expressions = expressionsRef.current[nodeId] || {};

          if (uniformConfig.type === "number") {
            const expression = expressions[uniformName];
            if (expression) {
              shader.uniforms[uniformName].value = evaluate(expression, state);
            }
          } else if (["vec2", "vec3", "vec4"].includes(uniformConfig.type)) {
            uniformConfig.vectorComponents?.forEach((component) => {
              const expression = expressions[`${uniformName}.${component}`];
              if (expression) {
                shader.uniforms[uniformName].value[component] = evaluate(
                  expression,
                  state,
                );
              }
            });
          }
        },
      );
    },
    [textureType, connectionCache, targets, nodeTypes, evaluate],
  );

  return {
    updateTextureUniforms,
    shaderCache,
    expressionsRef,
  };
}
```

### Expression Evaluator Integration

```typescript
// apps/app/src/app/(app)/(workspace)/workspace/hooks/use-expression-evaluator.ts
export function useExpressionEvaluator() {
  const timeRef = useRef({ frame: 0, time: 0 });

  const getTimeContext = useCallback(() => {
    return {
      frame: timeRef.current.frame,
      time: timeRef.current.time,
    };
  }, []);

  const incrementFrame = useCallback(() => {
    timeRef.current.frame += 1;
    timeRef.current.time = performance.now() / 1000;
  }, []);

  const evaluate = useCallback(
    (
      expression: string | number | undefined,
      state: WebGLRootState,
      defaultValue = 0,
    ): number => {
      if (typeof expression === "number") return expression;
      if (!expression || !isExpression(expression)) return defaultValue;

      try {
        // Remove the $ prefix
        const expr = expression.slice(1);

        // Create context for evaluation
        const context = {
          ...getTimeContext(),
          ...state,
        };

        // Evaluate expression safely
        return evaluateExpression(expr, context);
      } catch (error) {
        console.error("Expression evaluation error:", error);
        return defaultValue;
      }
    },
    [getTimeContext],
  );

  return {
    evaluate,
    getTimeContext,
    incrementFrame,
  };
}
```

### Node Component Integration

```typescript
// apps/app/src/app/(app)/(workspace)/workspace/components/nodes/TextureNode.tsx
export function TextureNode({ id, type }: TextureNodeProps) {
  const {
    updateTextureUniforms,
    shaderCache,
    expressionsRef,
  } = useUpdateTexture(type);

  const config = TEXTURE_TYPE_REGISTRY[type];

  useEffect(() => {
    if (!config) return;

    // Initialize shader if not cached
    if (!shaderCache.current[id]) {
      const shader = new THREE.ShaderMaterial({
        vertexShader: baseVertexShader,
        fragmentShader: config.fragmentShader,
        uniforms: createDefaultUniforms(config),
      });
      shaderCache.current[id] = shader;
    }

    // Initialize expressions
    expressionsRef.current[id] = {};
    Object.entries(config.uniformConfigs).forEach(([uniformName, uniformConfig]) => {
      if (!uniformConfig.isExpression) return;

      if (["vec2", "vec3", "vec4"].includes(uniformConfig.type)) {
        uniformConfig.vectorComponents?.forEach(component => {
          const key = `${uniformName}.${component}`;
          const value = uniforms[uniformName]?.[component];
          if (isExpression(value)) {
            expressionsRef.current[id]![key] = value;
          }
        });
      } else {
        const value = uniforms[uniformName];
        if (isExpression(value)) {
          expressionsRef.current[id]![uniformName] = value;
        }
      }
    });

    return () => {
      // Cleanup
      delete shaderCache.current[id];
      delete expressionsRef.current[id];
    };
  }, [id, type, config]);

  useFrame(state => {
    const shader = shaderCache.current[id];
    if (!shader) return;
    updateTextureUniforms(shader, id, state);
  });

  return (
    <NodeWrapper id={id}>
      {config?.handles.map(handle => (
        <Handle
          key={handle.id}
          id={handle.id}
          type="target"
          position={Position.Left}
        />
      ))}
      <TexturePreview shader={shaderCache.current[id]} />
    </NodeWrapper>
  );
}
```

## Implementation Notes

1. **Expression System Integration**:

   - Preserved expression evaluation capabilities
   - Integrated with new handle-based system
   - Maintained type safety
   - Clear separation of concerns

2. **Complex Uniform Support**:

   - Support for vector uniforms (vec2, vec3, vec4)
   - Expression support for vector components
   - Type-safe uniform configuration
   - Proper cleanup and resource management

3. **Performance Optimizations**:

   - Shader caching
   - Expression caching
   - Efficient updates
   - Proper cleanup

4. **Resource Management**:

   - Clear ownership of resources
   - Proper cleanup on unmount
   - Memory leak prevention
   - Efficient caching strategies

5. **Type Safety**:
   - Strong typing throughout
   - Clear validation boundaries
   - Proper error handling
   - Comprehensive type definitions

```

```
