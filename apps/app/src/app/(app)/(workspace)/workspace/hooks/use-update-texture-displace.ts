import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

import {
  baseVertexShader,
  displaceFragmentShader,
  isExpression,
} from "@repo/webgl";

import type { WebGLRootState } from "../components/webgl/webgl-primitives";
import type { TextureRenderNode } from "../types/render";
import type { DisplaceTexture, Texture } from "~/db/schema/types/Texture";
import { api } from "~/trpc/client/react";
import { useEdgeStore } from "../providers/edge-store-provider";
import { useTextureRenderStore } from "../providers/texture-render-store-provider";
import { useExpressionEvaluator } from "./use-expression-evaluator";

export const useUpdateTextureDisplace = (): TextureRenderNode[] => {
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
      .filter((entry): entry is [string, DisplaceTexture] => {
        const [_, texture] = entry;
        return texture?.type === "Displace";
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

        storeExpression("u_displaceWeight", u.u_displaceWeight);
        storeExpression("u_displaceMidpoint.x", u.u_displaceMidpoint.x);
        storeExpression("u_displaceMidpoint.y", u.u_displaceMidpoint.y);
        storeExpression("u_displaceOffset.x", u.u_displaceOffset.x);
        storeExpression("u_displaceOffset.y", u.u_displaceOffset.y);
        storeExpression("u_displaceOffsetWeight", u.u_displaceOffsetWeight);
        storeExpression("u_displaceUVWeight.x", u.u_displaceUVWeight.x);
        storeExpression("u_displaceUVWeight.y", u.u_displaceUVWeight.y);

        // Create default vector values
        const defaultMidpoint = new THREE.Vector2(0.5, 0.5);
        const defaultOffset = new THREE.Vector2(0, 0);
        const defaultUVWeight = new THREE.Vector2(1.0, 1.0);

        // Reuse shader if available
        if (!shaderCache.current[id]) {
          shaderCache.current[id] = new THREE.ShaderMaterial({
            vertexShader: baseVertexShader,
            fragmentShader: displaceFragmentShader,
            uniforms: {
              u_texture1: { value: null }, // Source image
              u_texture2: { value: null }, // Displacement map
              u_displaceWeight: {
                value:
                  typeof u.u_displaceWeight === "number"
                    ? u.u_displaceWeight
                    : 1.0,
              },
              u_displaceMidpoint: { value: defaultMidpoint.clone() },
              u_displaceOffset: { value: defaultOffset.clone() },
              u_displaceOffsetWeight: {
                value:
                  typeof u.u_displaceOffsetWeight === "number"
                    ? u.u_displaceOffsetWeight
                    : 1.0,
              },
              u_displaceUVWeight: { value: defaultUVWeight.clone() },
            },
          });
        }

        // Update uniform values
        const shader = shaderCache.current[id];
        if (
          shader.uniforms.u_displaceWeight &&
          typeof u.u_displaceWeight === "number"
        ) {
          shader.uniforms.u_displaceWeight.value = u.u_displaceWeight;
        }

        // Update vector uniforms
        if (shader.uniforms.u_displaceMidpoint) {
          const x =
            typeof u.u_displaceMidpoint.x === "number"
              ? u.u_displaceMidpoint.x
              : 0.5;
          const y =
            typeof u.u_displaceMidpoint.y === "number"
              ? u.u_displaceMidpoint.y
              : 0.5;
          shader.uniforms.u_displaceMidpoint.value.set(x, y);
        }

        if (shader.uniforms.u_displaceOffset) {
          const x =
            typeof u.u_displaceOffset.x === "number" ? u.u_displaceOffset.x : 0;
          const y =
            typeof u.u_displaceOffset.y === "number" ? u.u_displaceOffset.y : 0;
          shader.uniforms.u_displaceOffset.value.set(x, y);
        }

        if (
          shader.uniforms.u_displaceOffsetWeight &&
          typeof u.u_displaceOffsetWeight === "number"
        ) {
          shader.uniforms.u_displaceOffsetWeight.value =
            u.u_displaceOffsetWeight;
        }

        if (shader.uniforms.u_displaceUVWeight) {
          const x =
            typeof u.u_displaceUVWeight.x === "number"
              ? u.u_displaceUVWeight.x
              : 1.0;
          const y =
            typeof u.u_displaceUVWeight.y === "number"
              ? u.u_displaceUVWeight.y
              : 1.0;
          shader.uniforms.u_displaceUVWeight.value.set(x, y);
        }

        return {
          id,
          shader,
          onEachFrame: (state: WebGLRootState) => {
            // Get expressions for this node
            const expressions = expressionsRef.current[id] || {};

            // Define mapping for vector uniform components
            const uniformPathMap = {
              "u_displaceMidpoint.x": {
                pathToValue: "u_displaceMidpoint.value",
              },
              "u_displaceMidpoint.y": {
                pathToValue: "u_displaceMidpoint.value.y",
              },
              "u_displaceOffset.x": { pathToValue: "u_displaceOffset.value.x" },
              "u_displaceOffset.y": { pathToValue: "u_displaceOffset.value.y" },
              "u_displaceUVWeight.x": {
                pathToValue: "u_displaceUVWeight.value",
              },
              "u_displaceUVWeight.y": {
                pathToValue: "u_displaceUVWeight.value.y",
              },
            };

            // Update the texture references according to connections
            const nodeConnections = connectionCache.current[id] || {};

            // Map input-1 to u_texture1 (source image)
            if (shader.uniforms.u_texture1) {
              const sourceId = nodeConnections["input-1"];
              shader.uniforms.u_texture1.value = sourceId
                ? targets[sourceId]?.texture
                : null;
            }

            // Map input-2 to u_texture2 (displacement map)
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
