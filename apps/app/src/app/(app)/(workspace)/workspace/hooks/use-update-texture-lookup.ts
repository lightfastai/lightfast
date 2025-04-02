import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

import {
  baseVertexShader,
  IndexChannel,
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

        // Store expressions for new parameters
        storeExpression("u_indexRange", u.u_indexRange);
        storeExpression("u_darkUV", u.u_darkUV);
        storeExpression("u_lightUV", u.u_lightUV);

        // Reuse shader if available
        if (!shaderCache.current[id]) {
          shaderCache.current[id] = new THREE.ShaderMaterial({
            vertexShader: baseVertexShader,
            fragmentShader: lookupFragmentShader,
            uniforms: {
              u_texture1: { value: null },
              u_texture2: { value: null },
              u_indexRange: {
                value:
                  typeof u.u_indexRange === "object" &&
                  !isExpression(u.u_indexRange)
                    ? u.u_indexRange
                    : { x: 0.0, y: 1.0 },
              },
              u_indexChannel: {
                value: u.u_indexChannel || IndexChannel.RGBA_INDEPENDENT,
              },
              u_independentAlpha: {
                value: u.u_independentAlpha || false,
              },
              u_darkUV: {
                value:
                  typeof u.u_darkUV === "object" && !isExpression(u.u_darkUV)
                    ? u.u_darkUV
                    : { x: 0.0, y: 0.0 },
              },
              u_lightUV: {
                value:
                  typeof u.u_lightUV === "object" && !isExpression(u.u_lightUV)
                    ? u.u_lightUV
                    : { x: 1.0, y: 0.0 },
              },
              u_displayLookup: {
                value: u.u_displayLookup || false,
              },
            },
          });
        }

        // Update uniform values
        const shader = shaderCache.current[id];
        if (
          shader.uniforms.u_indexRange &&
          typeof u.u_indexRange === "object" &&
          !isExpression(u.u_indexRange)
        ) {
          shader.uniforms.u_indexRange.value = u.u_indexRange;
        }
        if (shader.uniforms.u_indexChannel) {
          shader.uniforms.u_indexChannel.value =
            u.u_indexChannel || IndexChannel.RGBA_INDEPENDENT;
        }
        if (shader.uniforms.u_independentAlpha) {
          shader.uniforms.u_independentAlpha.value =
            u.u_independentAlpha || false;
        }
        if (
          shader.uniforms.u_darkUV &&
          typeof u.u_darkUV === "object" &&
          !isExpression(u.u_darkUV)
        ) {
          shader.uniforms.u_darkUV.value = u.u_darkUV;
        }
        if (
          shader.uniforms.u_lightUV &&
          typeof u.u_lightUV === "object" &&
          !isExpression(u.u_lightUV)
        ) {
          shader.uniforms.u_lightUV.value = u.u_lightUV;
        }
        if (shader.uniforms.u_displayLookup) {
          shader.uniforms.u_displayLookup.value = u.u_displayLookup || false;
        }

        return {
          id,
          shader,
          onEachFrame: (state: WebGLRootState) => {
            // Get expressions for this node
            const expressions = expressionsRef.current[id] || {};

            // Define mapping for uniform components
            const uniformPathMap = {
              u_indexRange: { pathToValue: "u_indexRange.value" },
              u_darkUV: { pathToValue: "u_darkUV.value" },
              u_lightUV: { pathToValue: "u_lightUV.value" },
            };

            // Update the texture references according to connections
            const nodeConnections = connectionCache.current[id] || {};

            // Map input-1 to u_texture1 (source texture)
            if (shader.uniforms.u_texture1) {
              const sourceId = nodeConnections["input-1"];
              shader.uniforms.u_texture1.value = sourceId
                ? targets[sourceId]?.texture
                : null;
            }

            // Map input-2 to u_texture2 (lookup table)
            if (shader.uniforms.u_texture2) {
              const sourceId = nodeConnections["input-2"];
              shader.uniforms.u_texture2.value = sourceId
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
