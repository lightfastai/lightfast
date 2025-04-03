import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

import type { AddTexture, Texture } from "@vendor/db/types";
import { addFragmentShader, baseVertexShader, isExpression } from "@repo/webgl";

import type { TextureRenderNode } from "../types/render";
import type { WebGLRootState } from "../webgl";
import { api } from "~/trpc/client/react";
import { useEdgeStore } from "../providers/edge-store-provider";
import { useTextureRenderStore } from "../providers/texture-render-store-provider";
import { useExpressionEvaluator } from "./use-expression-evaluator";

export const useUpdateTextureAdd = (): TextureRenderNode[] => {
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
        return texture?.type === "Add";
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

        // Reuse shader if available
        if (!shaderCache.current[id]) {
          shaderCache.current[id] = new THREE.ShaderMaterial({
            vertexShader: baseVertexShader,
            fragmentShader: addFragmentShader,
            uniforms: {
              u_texture1: { value: null }, // First input texture (A)
              u_texture2: { value: null }, // Second input texture (B)
              u_addValue: {
                value: typeof u.u_addValue === "number" ? u.u_addValue : 0.0,
              },
              u_enableMirror: {
                value: Boolean(u.u_enableMirror),
              },
            },
          });
        }

        // Update uniform values
        const shader = shaderCache.current[id];
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

            // Update the texture references according to connections
            const nodeConnections = connectionCache.current[id] || {};

            // Map input-1 to u_texture1 (first input)
            if (shader.uniforms.u_texture1) {
              const sourceId = nodeConnections["input-1"];
              shader.uniforms.u_texture1.value = sourceId
                ? targets[sourceId]?.texture
                : null;

              // Also set the u_texture for backward compatibility
              if (shader.uniforms.u_texture) {
                shader.uniforms.u_texture.value =
                  shader.uniforms.u_texture1.value;
              }
            }

            // Map input-2 to u_texture2 (second input)
            if (shader.uniforms.u_texture2) {
              const sourceId = nodeConnections["input-2"];
              shader.uniforms.u_texture2.value = sourceId
                ? targets[sourceId]?.texture
                : null;
            }

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
