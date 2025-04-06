import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

import type { WebGLRenderTargetNode, WebGLRootState } from "@repo/webgl";
import type { AddTexture, Texture } from "@vendor/db/types";
import {
  addFragmentShader,
  baseVertexShader,
  getTextureInputsForType,
  isExpression,
} from "@repo/webgl";

import { useEdgeStore } from "../providers/edge-store-provider";
import { useTextureRenderStore } from "../providers/texture-render-store-provider";
import { useExpressionEvaluator } from "./use-expression-evaluator";

export interface UpdateTextureAddProps {
  textureDataMap: Record<string, Texture>;
}

export const useUpdateTextureAdd = ({
  textureDataMap,
}: UpdateTextureAddProps): WebGLRenderTargetNode[] => {
  const { targets } = useTextureRenderStore((state) => state);
  const { edges } = useEdgeStore((state) => state);
  // Cache of previously created shaders to avoid recreating them
  const shaderCache = useRef<Record<string, THREE.ShaderMaterial>>({});
  // Cache of connections between nodes to input handles
  const connectionCache = useRef<Record<string, Record<string, string | null>>>(
    {},
  );
  // Cache expressions
  const expressionsRef = useRef<Record<string, Record<string, string>>>({});
  // Use the shared expression evaluator
  const { updateShaderUniforms } = useExpressionEvaluator();

  // Update connection cache when edges change
  useEffect(() => {
    // First, initialize structure for each node if not already done
    Object.keys(targets).forEach((nodeId) => {
      if (!connectionCache.current[nodeId]) {
        connectionCache.current[nodeId] = {};
      }
    });

    // Process edges to map connections to input handles
    edges.forEach((edge) => {
      const targetId = edge.target;
      const sourceId = edge.source;
      const handleId = edge.targetHandle || "input-1"; // Default to input-1 if not specified

      // Store the connection in the cache
      if (connectionCache.current[targetId]) {
        connectionCache.current[targetId][handleId] = sourceId;
      }
    });
  }, [edges, targets]);

  // Create render nodes only when necessary
  return useMemo(() => {
    return Object.entries(textureDataMap)
      .filter((entry): entry is [string, AddTexture] => {
        const [_, texture] = entry;
        return texture.type === "Add";
      })
      .map(([id, texture]) => {
        const { uniforms: u } = texture;

        // Ensure expressions cache exists for this ID
        expressionsRef.current[id] = expressionsRef.current[id] || {};

        // Store all expressions for this node
        const storeExpression = (key: string, value: any) => {
          if (isExpression(value)) {
            expressionsRef.current[id]![key] = value;
          }
        };

        // Only store numeric expressions
        storeExpression("u_addValue", u.u_addValue);

        // Get texture inputs metadata for initialization
        const textureInputs = getTextureInputsForType(texture.type);

        // Reuse shader if available
        if (!shaderCache.current[id]) {
          // Initialize the shader material
          shaderCache.current[id] = new THREE.ShaderMaterial({
            vertexShader: baseVertexShader,
            fragmentShader: addFragmentShader,
            uniforms: {
              // Initialize texture uniforms based on metadata
              u_texture1: { value: null },
              u_texture2: { value: null },
              // Regular uniforms
              u_addValue: {
                value: typeof u.u_addValue === "number" ? u.u_addValue : 0.0,
              },
              u_enableMirror: {
                value: Boolean(u.u_enableMirror),
              },
            },
          });
        }

        // Get the shader from cache
        const shader = shaderCache.current[id];

        // Update regular uniform values (non-texture)
        if (shader.uniforms.u_addValue && typeof u.u_addValue === "number") {
          shader.uniforms.u_addValue.value = u.u_addValue;
        }
        // Update boolean uniform directly
        if (shader.uniforms.u_enableMirror) {
          shader.uniforms.u_enableMirror.value = Boolean(u.u_enableMirror);
        }

        return {
          id,
          shader,
          onEachFrame: (state: WebGLRootState) => {
            // Get expressions for this node
            const expressions = expressionsRef.current[id] || {};

            // Define mapping for uniform components (only numeric uniforms)
            const uniformPathMap = {
              u_addValue: {
                pathToValue: "u_addValue.value",
              },
            };

            // Get node connections
            const nodeConnections = connectionCache.current[id] || {};

            // Update texture uniforms based on connections
            textureInputs.forEach((input) => {
              const { handle } = input;

              const { id: handleId, uniformName } = handle;

              // Get the source node ID from the connection cache
              const sourceId = nodeConnections[handleId] || null;
              // Get the texture object from the targets
              const textureObject =
                sourceId && targets[sourceId]?.texture
                  ? targets[sourceId].texture
                  : null;

              // Update the shader uniform
              if (shader.uniforms[uniformName]) {
                shader.uniforms[uniformName].value = textureObject;
              }

              // Update the texture data structure if it uses the new TextureUniform format
              // if (isShaderUniform(u[uniformName as keyof typeof u])) {
              //   (u[uniformName as keyof typeof u] as any) = updateShaderUniform(
              //     u[uniformName as keyof typeof u] as any,
              //     sourceId ? targets[sourceId] : null,
              //     textureObject,
              //   );
              // }
            });

            // Update boolean uniform
            if (shader.uniforms.u_enableMirror) {
              shader.uniforms.u_enableMirror.value = Boolean(u.u_enableMirror);
            }

            // Use the shared uniform update utility (only for numeric uniforms)
            updateShaderUniforms(state, shader, expressions, uniformPathMap);
          },
        };
      });
  }, [textureDataMap, targets, updateShaderUniforms]);
};
