# Unified Texture Update Implementation Plan

## Overview

This document outlines the implementation plan for a unified texture update system that replaces the multiple specialized hooks (`useUpdateTextureAdd`, `useUpdateTextureDisplace`, etc.) with a single, configuration-driven hook.

## Current Problems

The existing implementation has several issues:

1. **Code Duplication**: Each texture type has its own update hook with nearly identical patterns
2. **Inconsistent Connection Handling**: Different hooks use different approaches for tracking connections
3. **Hard-Coded Uniform Handling**: Uniform types, defaults, and expressions are hard-coded in each hook
4. **Maintenance Challenges**: Adding or modifying a texture type requires changes to multiple files
5. **Type Safety Gaps**: Lack of strong typing for uniform configurations

## Implementation Strategy

### Phase 9.1: Define Type-Safe Configuration Registry

1. **Create Core Configuration Types**

```typescript
// packages/webgl/src/types/texture-config.ts

export type UniformType =
  | "texture"
  | "number"
  | "boolean"
  | "vec2"
  | "vec3"
  | "vec4";

export interface BaseUniformConfig {
  type: UniformType;
  defaultValue: any;
  isExpression?: boolean;
  description?: string;
}

export interface TextureUniformConfig extends BaseUniformConfig {
  type: "texture";
  defaultValue: null;
}

export interface NumberUniformConfig extends BaseUniformConfig {
  type: "number";
  defaultValue: number;
  min?: number;
  max?: number;
  step?: number;
}

export interface BooleanUniformConfig extends BaseUniformConfig {
  type: "boolean";
  defaultValue: boolean;
}

export interface VectorUniformConfig extends BaseUniformConfig {
  type: "vec2" | "vec3" | "vec4";
  defaultValue: { x: number; y: number; z?: number; w?: number };
  vectorComponents: string[];
}

export type UniformConfig =
  | TextureUniformConfig
  | NumberUniformConfig
  | BooleanUniformConfig
  | VectorUniformConfig;

export interface HandleConfig {
  id: string;
  uniformName: string;
  description: string;
  required: boolean;
}

export interface TextureTypeConfig {
  fragmentShader: string;
  uniformConfig: Record<string, UniformConfig>;
  handles: HandleConfig[];
}
```

2. **Implement Registry for All Texture Types**

```typescript
// packages/webgl/src/types/texture-registry.ts

import { addFragmentShader } from "../shaders/add";
import { displaceFragmentShader } from "../shaders/displace";
import { limitFragmentShader } from "../shaders/limit";
import { pnoiseFragmentShader } from "../shaders/pnoise";
import { TextureTypeConfig } from "./texture-config";

export const TEXTURE_TYPE_REGISTRY: Record<string, TextureTypeConfig> = {
  Add: {
    fragmentShader: addFragmentShader,
    uniformConfig: {
      u_texture1: {
        type: "texture",
        defaultValue: null,
      },
      u_texture2: {
        type: "texture",
        defaultValue: null,
      },
      u_addValue: {
        type: "number",
        defaultValue: 0.0,
        isExpression: true,
        min: -1.0,
        max: 1.0,
        step: 0.01,
        description: "Value to add to the texture blend",
      },
      u_enableMirror: {
        type: "boolean",
        defaultValue: false,
        description: "Whether to mirror the second texture",
      },
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

  Displace: {
    fragmentShader: displaceFragmentShader,
    uniformConfig: {
      u_texture1: {
        type: "texture",
        defaultValue: null,
        description: "Source texture",
      },
      u_texture2: {
        type: "texture",
        defaultValue: null,
        description: "Displacement map",
      },
      u_displaceWeight: {
        type: "number",
        defaultValue: 1.0,
        isExpression: true,
        min: 0,
        max: 10,
        step: 0.1,
        description: "Displacement intensity",
      },
      u_displaceMidpoint: {
        type: "vec2",
        defaultValue: { x: 0.5, y: 0.5 },
        isExpression: true,
        vectorComponents: ["x", "y"],
        description: "Center point of displacement",
      },
      u_displaceOffset: {
        type: "vec2",
        defaultValue: { x: 0, y: 0 },
        isExpression: true,
        vectorComponents: ["x", "y"],
        description: "Offset for displacement",
      },
      u_displaceOffsetWeight: {
        type: "number",
        defaultValue: 1.0,
        isExpression: true,
        min: 0,
        max: 10,
        step: 0.1,
        description: "Offset weight",
      },
      u_displaceUVWeight: {
        type: "vec2",
        defaultValue: { x: 1.0, y: 1.0 },
        isExpression: true,
        vectorComponents: ["x", "y"],
        description: "UV weight for displacement",
      },
    },
    handles: [
      {
        id: "input-1",
        uniformName: "u_texture1",
        description: "Source Texture",
        required: true,
      },
      {
        id: "input-2",
        uniformName: "u_texture2",
        description: "Displacement Map",
        required: true,
      },
    ],
  },

  // Similarly define for Limit and Noise types...
};

/**
 * Get configuration for a specific texture type
 */
export function getTextureTypeConfig(
  textureType: string,
): TextureTypeConfig | null {
  return TEXTURE_TYPE_REGISTRY[textureType] || null;
}

/**
 * Get texture inputs for a specific texture type (backwards compatibility)
 */
export function getTextureInputsForType(textureType: string): {
  id: string;
  uniformName: string;
  description: string;
  required: boolean;
}[] {
  const config = TEXTURE_TYPE_REGISTRY[textureType];
  if (!config) return [];
  return config.handles;
}
```

### Phase 9.2: Implement the Unified Update Hook

1. **Create Unified Texture Update Hook**

```typescript
// apps/app/src/app/(app)/(workspace)/workspace/hooks/use-update-texture.ts

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

import type { WebGLRenderTargetNode, WebGLRootState } from "@repo/webgl";
import type { Texture } from "@vendor/db/types";
import {
  baseVertexShader,
  getTextureTypeConfig,
  isExpression,
  isTextureUniform,
  updateTextureUniform,
} from "@repo/webgl";

import { useEdgeStore } from "../providers/edge-store-provider";
import { useTextureRenderStore } from "../providers/texture-render-store-provider";
import { useExpressionEvaluator } from "./use-expression-evaluator";

export interface UpdateTextureProps {
  textureDataMap: Record<string, Texture>;
}

export const useUpdateTexture = ({
  textureDataMap,
}: UpdateTextureProps): WebGLRenderTargetNode[] => {
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
        const config = getTextureTypeConfig(texture.type);
        if (!config) return null;

        const { uniforms: u } = texture;

        // Ensure expressions cache exists for this ID
        expressionsRef.current[id] = expressionsRef.current[id] || {};

        // Store expressions for this node based on config
        Object.entries(config.uniformConfig).forEach(
          ([uniformName, uniformConfig]) => {
            if (uniformConfig.isExpression) {
              if (
                uniformConfig.type === "vec2" ||
                uniformConfig.type === "vec3" ||
                uniformConfig.type === "vec4"
              ) {
                // Handle vector components
                (uniformConfig.vectorComponents || []).forEach((component) => {
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
                case "vec3":
                  const vec3 = new THREE.Vector3(
                    typeof u[uniformName]?.x === "number"
                      ? u[uniformName].x
                      : uniformConfig.defaultValue.x,
                    typeof u[uniformName]?.y === "number"
                      ? u[uniformName].y
                      : uniformConfig.defaultValue.y,
                    typeof u[uniformName]?.z === "number"
                      ? u[uniformName].z
                      : uniformConfig.defaultValue.z || 0,
                  );
                  uniforms[uniformName] = { value: vec3 };
                  break;
                case "vec4":
                  const vec4 = new THREE.Vector4(
                    typeof u[uniformName]?.x === "number"
                      ? u[uniformName].x
                      : uniformConfig.defaultValue.x,
                    typeof u[uniformName]?.y === "number"
                      ? u[uniformName].y
                      : uniformConfig.defaultValue.y,
                    typeof u[uniformName]?.z === "number"
                      ? u[uniformName].z
                      : uniformConfig.defaultValue.z || 0,
                    typeof u[uniformName]?.w === "number"
                      ? u[uniformName].w
                      : uniformConfig.defaultValue.w || 0,
                  );
                  uniforms[uniformName] = { value: vec4 };
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

        // Update non-texture uniform values with latest data
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
                case "vec3":
                case "vec4":
                  if (u[uniformName]) {
                    // For vec2, vec3, vec4 we need to set individual components
                    Object.entries(u[uniformName]).forEach(
                      ([component, value]) => {
                        if (
                          typeof value === "number" &&
                          component in shader.uniforms[uniformName].value
                        ) {
                          shader.uniforms[uniformName].value[component] = value;
                        }
                      },
                    );
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
                    uniformConfig.type === "vec2" ||
                    uniformConfig.type === "vec3" ||
                    uniformConfig.type === "vec4"
                  ) {
                    (uniformConfig.vectorComponents || []).forEach(
                      (component) => {
                        uniformPathMap[`${uniformName}.${component}`] = {
                          pathToValue: `${uniformName}.value.${component}`,
                        };
                      },
                    );
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
              const textureObject =
                sourceId && targets[sourceId]?.texture
                  ? targets[sourceId].texture
                  : null;

              if (shader.uniforms[handle.uniformName]) {
                // Update the shader uniform with the texture
                shader.uniforms[handle.uniformName].value = textureObject;

                // Also update the TextureUniform in the node data if present
                if (isTextureUniform(u[handle.uniformName])) {
                  (u[handle.uniformName] as any) = updateTextureUniform(
                    u[handle.uniformName] as any,
                    sourceId,
                    textureObject,
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

### Phase 9.3: Integration and Compatibility

1. **Create the Master Update Hook**

```typescript
// apps/app/src/app/(app)/(workspace)/workspace/hooks/use-update-textures.ts

import { useMemo } from "react";

import type { WebGLRenderTargetNode } from "@repo/webgl";
import type { Texture } from "@vendor/db/types";

import { useUpdateTexture } from "./use-update-texture";

/**
 * Master hook that provides texture updates for all textures in the system
 */
export const useUpdateTextures = ({
  textureDataMap,
}: {
  textureDataMap: Record<string, Texture>;
}): WebGLRenderTargetNode[] => {
  // Use the new unified hook
  const textureNodes = useUpdateTexture({ textureDataMap });

  return useMemo(() => {
    return textureNodes;
  }, [textureNodes]);
};
```

2. **Update Dependencies in WebGL Canvas**

```typescript
// In WebGLCanvas component

// Replace individual hooks with master hook
const textureNodes = useUpdateTextures({ textureDataMap });

// Use the nodes for rendering
useFrame(() => {
  textureNodes.forEach((node) => {
    // Render logic
  });
});
```

## Testing Strategy

1. **Test with Each Texture Type**

   - Verify that each texture type renders correctly
   - Check that expressions are evaluated properly
   - Validate that connections work as expected

2. **Performance Testing**

   - Compare rendering performance with previous implementation
   - Check memory usage patterns
   - Ensure no regressions in frame rate

3. **Edge Case Validation**
   - Test with missing texture connections
   - Validate behavior with invalid configurations
   - Verify type safety of the implementation

## Migration Plan

1. **Implementation Order**

   - Phase 9.1: Define configurations (1-2 days)
   - Phase 9.2: Implement unified hook (2-3 days)
   - Phase 9.3: Integration (1-2 days)

2. **Incremental Rollout**

   - Convert each texture type one at a time, starting with the simplest (Limit)
   - Run parallel testing against existing implementation
   - Gradually switch all texture types to the new system

3. **Backward Compatibility**
   - Maintain the old hooks as wrappers temporarily
   - Add deprecation warnings
   - Remove after full migration
