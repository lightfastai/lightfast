import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

import type { WebGLRenderTargetNode, WebGLRootState } from "@repo/webgl";
import type { LimitTexture, Texture } from "@vendor/db/types";
import {
  baseVertexShader,
  isExpression,
  limitFragmentShader,
} from "@repo/webgl";

import { useEdgeStore } from "../providers/edge-store-provider";
import { useTextureRenderStore } from "../providers/texture-render-store-provider";
import { useExpressionEvaluator } from "./use-expression-evaluator";

export interface UpdateTextureLimitProps {
  textureDataMap: Record<string, Texture>;
}

export const useUpdateTextureLimit = ({
  textureDataMap,
}: UpdateTextureLimitProps): WebGLRenderTargetNode[] => {
  const { targets } = useTextureRenderStore((state) => state);
  const { edges } = useEdgeStore((state) => state);
  // Cache of previously created shaders to avoid recreating them
  const shaderCache = useRef<Record<string, THREE.ShaderMaterial>>({});
  // Cache of connections between nodes
  const connectionCache = useRef<Record<string, string | null>>({});
  // Cache expressions
  const expressionsRef = useRef<Record<string, Record<string, string>>>({});
  // Use the shared expression evaluator
  const { updateShaderUniforms } = useExpressionEvaluator();

  // Update connection cache when edges change
  useEffect(() => {
    // Reset connections that might have changed
    connectionCache.current = {};

    // Populate with current connections
    edges.forEach((edge) => {
      connectionCache.current[edge.target] = edge.source;
    });
  }, [edges]);

  // Create render nodes only when necessary
  return useMemo(() => {
    return Object.entries(textureDataMap)
      .filter((entry): entry is [string, LimitTexture] => {
        const [_, texture] = entry;
        return texture.type === "Limit";
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

        storeExpression("u_quantizationSteps", u.u_quantizationSteps);

        // Reuse shader if available
        if (!shaderCache.current[id]) {
          shaderCache.current[id] = new THREE.ShaderMaterial({
            vertexShader: baseVertexShader,
            fragmentShader: limitFragmentShader,
            uniforms: {
              u_texture1: { value: null },
              u_quantizationSteps: {
                value:
                  typeof u.u_quantizationSteps === "number"
                    ? u.u_quantizationSteps
                    : 8,
              },
            },
          });
        }

        // Update uniform values (but not the uniform objects themselves)
        const shader = shaderCache.current[id];
        if (
          shader.uniforms.u_quantizationSteps &&
          typeof u.u_quantizationSteps === "number"
        ) {
          shader.uniforms.u_quantizationSteps.value = u.u_quantizationSteps;
        }

        return {
          id,
          shader,
          onEachFrame: (state: WebGLRootState) => {
            // Get expressions for this node
            const expressions = expressionsRef.current[id] || {};

            // Define mapping for uniform components
            const uniformPathMap = {
              u_quantizationSteps: {
                pathToValue: "u_quantizationSteps.value",
              },
            };

            // Update the texture reference
            const sourceId = connectionCache.current[id];
            if (shader.uniforms.u_texture1) {
              shader.uniforms.u_texture1.value = sourceId
                ? targets[sourceId]?.texture
                : null;
            }

            // Use the shared uniform update utility
            updateShaderUniforms(state, shader, expressions, uniformPathMap);
          },
        };
      });
  }, [textureDataMap, targets, updateShaderUniforms]);
};
