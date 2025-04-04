# Phase 1: Non-Texture Uniform Updates

## Overview

Implement a generalized system for handling non-texture uniforms with expression support, using the enhanced type system from Phase 10.

## Implementation

### 1. Enhanced Expression Types

```typescript
// packages/webgl/src/types/expression.ts
import { z } from "zod";

// Reuse from Phase 10
export type Expression = string & { readonly __brand: "Expression" };
export type ExpressionResult = number | boolean;

export interface ExpressionContext {
  time: number;
  delta: number;
  me: {
    time: {
      now: number;
      delta: number;
      elapsed: number;
      frame: number;
      fps: number;
      seconds: number;
      minutes: number;
      hours: number;
    };
  };
  [key: string]: any;
}

// Enhanced for vector support
export interface UniformPathConfig {
  uniformName: string;
  pathToValue?: string;
  type: "number" | "boolean" | "vec2" | "vec3" | "vec4";
  vectorComponents?: string[];
}

export interface UniformExpressionMap {
  [uniformName: string]: {
    expression: Expression;
    config: UniformPathConfig;
  };
}
```

### 2. Enhanced Uniform Configuration

```typescript
// packages/webgl/src/types/uniform-config.ts
import type { Expression } from "./expression";

export interface BaseUniformConfig {
  type: "number" | "boolean" | "vec2" | "vec3" | "vec4" | "texture";
  defaultValue: any;
  isExpression?: boolean;
  label?: string;
  description?: string;
}

export interface NumericUniformConfig extends BaseUniformConfig {
  type: "number";
  defaultValue: number;
  min?: number;
  max?: number;
  step?: number;
}

export interface VectorUniformConfig extends BaseUniformConfig {
  type: "vec2" | "vec3" | "vec4";
  defaultValue: { [key: string]: number };
  vectorComponents: string[];
  min?: number;
  max?: number;
}

export interface BooleanUniformConfig extends BaseUniformConfig {
  type: "boolean";
  defaultValue: boolean;
}

export type UniformConfig =
  | NumericUniformConfig
  | VectorUniformConfig
  | BooleanUniformConfig;

export interface UniformValue {
  value: number | boolean | { [key: string]: number } | Expression;
  config: UniformConfig;
}
```

### 3. Uniform Update Implementation

```typescript
// packages/webgl/src/utils/uniform-updates.ts
import type { ShaderMaterial } from "three";

import type {
  Expression,
  ExpressionContext,
  UniformPathConfig,
} from "../types/expression";
import type { UniformConfig, UniformValue } from "../types/uniform-config";

export function updateNumericUniform(
  shader: ShaderMaterial,
  uniformName: string,
  value: number | Expression,
  context: ExpressionContext,
): void {
  const uniform = shader.uniforms[uniformName];
  if (!uniform) return;

  if (isExpression(value)) {
    uniform.value = evaluateExpression(value, context);
  } else {
    uniform.value = value;
  }
}

export function updateVectorUniform(
  shader: ShaderMaterial,
  config: UniformPathConfig,
  value: { [key: string]: number | Expression },
  context: ExpressionContext,
): void {
  const uniform = shader.uniforms[config.uniformName];
  if (!uniform?.value) return;

  config.vectorComponents?.forEach((component) => {
    const componentValue = value[component];
    if (componentValue === undefined) return;

    if (isExpression(componentValue)) {
      uniform.value[component] = evaluateExpression(componentValue, context);
    } else {
      uniform.value[component] = componentValue;
    }
  });
}

export function updateBooleanUniform(
  shader: ShaderMaterial,
  uniformName: string,
  value: boolean | Expression,
  context: ExpressionContext,
): void {
  const uniform = shader.uniforms[uniformName];
  if (!uniform) return;

  if (isExpression(value)) {
    uniform.value = evaluateExpression(value, context) ? 1 : 0;
  } else {
    uniform.value = value ? 1 : 0;
  }
}
```

### 4. Integration with Update Hook

```typescript
// apps/app/src/app/(app)/(workspace)/workspace/hooks/use-update-texture.ts
export function useUpdateTexture(textureType: string) {
  const { evaluate, getTimeContext } = useExpressionEvaluator();
  const expressionsRef = useRef<Record<string, UniformExpressionMap>>({});

  const updateNonTextureUniforms = useCallback(
    (shader: THREE.ShaderMaterial, nodeId: string, state: WebGLRootState) => {
      const config = TEXTURE_TYPE_REGISTRY[textureType];
      if (!config) return;

      const context = getTimeContext(state);
      const expressions = expressionsRef.current[nodeId] || {};

      Object.entries(config.uniformConfigs).forEach(
        ([uniformName, uniformConfig]) => {
          if (uniformConfig.type === "texture") return;

          const expressionData = expressions[uniformName];
          if (!expressionData) return;

          switch (uniformConfig.type) {
            case "number":
              updateNumericUniform(
                shader,
                uniformName,
                expressionData.expression,
                context,
              );
              break;

            case "vec2":
            case "vec3":
            case "vec4":
              updateVectorUniform(
                shader,
                expressionData.config,
                expressionData.expression as any,
                context,
              );
              break;

            case "boolean":
              updateBooleanUniform(
                shader,
                uniformName,
                expressionData.expression,
                context,
              );
              break;
          }
        },
      );
    },
    [textureType, getTimeContext],
  );

  // Rest of the hook implementation...
}
```

### 5. Example Usage (Noise Texture)

```typescript
// Example configuration for Noise texture
const NoiseConfig: TextureRegistryEntry = {
  type: "Noise",
  uniformConfigs: {
    u_period: {
      type: "number",
      defaultValue: 2.0,
      isExpression: true,
      min: 0.1,
      max: 10.0,
    },
    u_scale: {
      type: "vec2",
      defaultValue: { x: 1, y: 1 },
      isExpression: true,
      vectorComponents: ["x", "y"],
      min: -10,
      max: 10,
    },
    u_enableAnimation: {
      type: "boolean",
      defaultValue: false,
      isExpression: true,
    },
  },
  // ... other config
};
```

## Migration Steps

1. **Update Types**

   - Implement enhanced expression types
   - Create uniform configuration types
   - Update registry types

2. **Implement Core Functionality**

   - Create uniform update utilities
   - Implement expression evaluation
   - Add vector uniform support

3. **Integration**

   - Update texture registry
   - Enhance update hook
   - Add migration utilities

4. **Testing**
   - Unit tests for uniform updates
   - Expression evaluation tests
   - Integration tests

## Validation

1. **Type Safety**

   - Ensure all uniform updates are type-safe
   - Validate expression evaluation
   - Check vector component access

2. **Performance**

   - Monitor expression evaluation
   - Check uniform update efficiency
   - Validate caching strategy

3. **Error Handling**
   - Invalid expression handling
   - Missing uniform handling
   - Type mismatch handling
