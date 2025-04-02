import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

import {
  baseVertexShader,
  isExpression,
  lookupFragmentShader,
} from "@repo/webgl";

import type { WebGLRootState } from "../components/webgl/webgl-primitives";
import type { TextureRenderNode } from "../types/render";
import type { LookupTexture, Texture } from "~/db/schema/types/Texture";
import { api } from "~/trpc/client/react";
import { useEdgeStore } from "../providers/edge-store-provider";
import { useTextureRenderStore } from "../providers/texture-render-store-provider";
import { useExpressionEvaluator } from "./use-expression-evaluator";

export const useUpdateTextureLookup = (): TextureRenderNode[] => {
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
      .filter((entry): entry is [string, LookupTexture] => {
        const [_, texture] = entry;
        return texture?.type === "Lookup";
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

        // Store numeric expressions
        storeExpression("u_redWeight", u.u_redWeight);
        storeExpression("u_greenWeight", u.u_greenWeight);
        storeExpression("u_blueWeight", u.u_blueWeight);
        storeExpression("u_alphaWeight", u.u_alphaWeight);

        // Reuse shader if available
        if (!shaderCache.current[id]) {
          shaderCache.current[id] = new THREE.ShaderMaterial({
            vertexShader: baseVertexShader,
            fragmentShader: lookupFragmentShader,
            uniforms: {
              u_texture: { value: null },
              u_lookupTexture: { value: null },
              u_redWeight: {
                value: typeof u.u_redWeight === "number" ? u.u_redWeight : 1.0,
              },
              u_greenWeight: {
                value:
                  typeof u.u_greenWeight === "number" ? u.u_greenWeight : 1.0,
              },
              u_blueWeight: {
                value:
                  typeof u.u_blueWeight === "number" ? u.u_blueWeight : 1.0,
              },
              u_alphaWeight: {
                value:
                  typeof u.u_alphaWeight === "number" ? u.u_alphaWeight : 1.0,
              },
            },
          });
        }

        // Update uniform values
        const shader = shaderCache.current[id];
        if (shader.uniforms.u_redWeight && typeof u.u_redWeight === "number") {
          shader.uniforms.u_redWeight.value = u.u_redWeight;
        }
        if (
          shader.uniforms.u_greenWeight &&
          typeof u.u_greenWeight === "number"
        ) {
          shader.uniforms.u_greenWeight.value = u.u_greenWeight;
        }
        if (
          shader.uniforms.u_blueWeight &&
          typeof u.u_blueWeight === "number"
        ) {
          shader.uniforms.u_blueWeight.value = u.u_blueWeight;
        }
        if (
          shader.uniforms.u_alphaWeight &&
          typeof u.u_alphaWeight === "number"
        ) {
          shader.uniforms.u_alphaWeight.value = u.u_alphaWeight;
        }

        return {
          id,
          shader,
          onEachFrame: (state: WebGLRootState) => {
            // Get expressions for this node
            const expressions = expressionsRef.current[id] || {};

            // Define mapping for uniform components
            const uniformPathMap = {
              u_redWeight: { pathToValue: "u_redWeight.value" },
              u_greenWeight: { pathToValue: "u_greenWeight.value" },
              u_blueWeight: { pathToValue: "u_blueWeight.value" },
              u_alphaWeight: { pathToValue: "u_alphaWeight.value" },
            };

            // Update the texture references according to connections
            const nodeConnections = connectionCache.current[id] || {};

            // Map input-1 to u_texture (source texture)
            if (shader.uniforms.u_texture) {
              const sourceId = nodeConnections["input-1"];
              shader.uniforms.u_texture.value = sourceId
                ? targets[sourceId]?.texture
                : null;
            }

            // Map input-2 to u_lookupTexture (lookup table)
            if (shader.uniforms.u_lookupTexture) {
              const sourceId = nodeConnections["input-2"];
              shader.uniforms.u_lookupTexture.value = sourceId
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
