import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

import {
  baseVertexShader,
  isExpression,
  limitFragmentShader,
} from "@repo/webgl";

import type { WebGLRootState } from "../components/webgl/webgl-primitives";
import type { TextureRenderNode } from "../types/render";
import type { LimitTexture, Texture } from "~/db/schema/types/Texture";
import { api } from "~/trpc/client/react";
import { useEdgeStore } from "../providers/edge-store-provider";
import { useTextureRenderStore } from "../providers/texture-render-store-provider";
import { useExpressionEvaluator } from "./use-expression-evaluator";

export const useUpdateTextureLimit = (): TextureRenderNode[] => {
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

  const queries = api.useQueries((t) =>
    Object.entries(targets).map(([id]) =>
      t.tenant.node.data.get<Texture>({ id }),
    ),
  );

  // Extract texture data only when queries change
  const textureDataMap = useMemo(() => {
    return Object.entries(targets).reduce<Record<string, Texture | null>>(
      (acc, [id], index) => {
        acc[id] = queries[index]?.data || null;
        return acc;
      },
      {},
    );
  }, [queries, targets]);

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
        return texture?.type === "Limit";
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
              u_texture: { value: null },
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
            if (shader.uniforms.u_texture) {
              shader.uniforms.u_texture.value = sourceId
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
