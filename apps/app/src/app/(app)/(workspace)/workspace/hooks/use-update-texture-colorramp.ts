import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

import {
  baseVertexShader,
  colorRampFragmentShader,
  isExpression,
} from "@repo/webgl";

import type { WebGLRootState } from "../components/webgl/webgl-primitives";
import type { TextureRenderNode } from "../types/render";
import type { ColorRampTexture, Texture } from "~/db/schema/types/Texture";
import { api } from "~/trpc/client/react";
import { useEdgeStore } from "../providers/edge-store-provider";
import { useTextureRenderStore } from "../providers/texture-render-store-provider";
import { useExpressionEvaluator } from "./use-expression-evaluator";

export const useUpdateTextureColorRamp = (): TextureRenderNode[] => {
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
      .filter((entry): entry is [string, ColorRampTexture] => {
        const [_, texture] = entry;
        return texture?.type === "ColorRamp";
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
        storeExpression("u_rampStart", u.u_rampStart);
        storeExpression("u_rampEnd", u.u_rampEnd);
        storeExpression("u_rampGamma", u.u_rampGamma);
        storeExpression("u_color1.x", u.u_color1.x);
        storeExpression("u_color1.y", u.u_color1.y);
        storeExpression("u_color1.z", u.u_color1.z);
        storeExpression("u_color2.x", u.u_color2.x);
        storeExpression("u_color2.y", u.u_color2.y);
        storeExpression("u_color2.z", u.u_color2.z);

        // Reuse shader if available
        if (!shaderCache.current[id]) {
          shaderCache.current[id] = new THREE.ShaderMaterial({
            vertexShader: baseVertexShader,
            fragmentShader: colorRampFragmentShader,
            uniforms: {
              u_texture: { value: null },
              u_color1: {
                value: new THREE.Vector3(
                  typeof u.u_color1.x === "number" ? u.u_color1.x : 0.0,
                  typeof u.u_color1.y === "number" ? u.u_color1.y : 0.0,
                  typeof u.u_color1.z === "number" ? u.u_color1.z : 0.0,
                ),
              },
              u_color2: {
                value: new THREE.Vector3(
                  typeof u.u_color2.x === "number" ? u.u_color2.x : 1.0,
                  typeof u.u_color2.y === "number" ? u.u_color2.y : 1.0,
                  typeof u.u_color2.z === "number" ? u.u_color2.z : 1.0,
                ),
              },
              u_rampStart: {
                value: typeof u.u_rampStart === "number" ? u.u_rampStart : 0.0,
              },
              u_rampEnd: {
                value: typeof u.u_rampEnd === "number" ? u.u_rampEnd : 1.0,
              },
              u_rampGamma: {
                value: typeof u.u_rampGamma === "number" ? u.u_rampGamma : 1.0,
              },
            },
          });
        }

        // Update uniform values
        const shader = shaderCache.current[id];
        if (shader.uniforms.u_color1) {
          shader.uniforms.u_color1.value.set(
            typeof u.u_color1.x === "number" ? u.u_color1.x : 0.0,
            typeof u.u_color1.y === "number" ? u.u_color1.y : 0.0,
            typeof u.u_color1.z === "number" ? u.u_color1.z : 0.0,
          );
        }
        if (shader.uniforms.u_color2) {
          shader.uniforms.u_color2.value.set(
            typeof u.u_color2.x === "number" ? u.u_color2.x : 1.0,
            typeof u.u_color2.y === "number" ? u.u_color2.y : 1.0,
            typeof u.u_color2.z === "number" ? u.u_color2.z : 1.0,
          );
        }
        if (shader.uniforms.u_rampStart && typeof u.u_rampStart === "number") {
          shader.uniforms.u_rampStart.value = u.u_rampStart;
        }
        if (shader.uniforms.u_rampEnd && typeof u.u_rampEnd === "number") {
          shader.uniforms.u_rampEnd.value = u.u_rampEnd;
        }
        if (shader.uniforms.u_rampGamma && typeof u.u_rampGamma === "number") {
          shader.uniforms.u_rampGamma.value = u.u_rampGamma;
        }

        return {
          id,
          shader,
          onEachFrame: (state: WebGLRootState) => {
            // Get expressions for this node
            const expressions = expressionsRef.current[id] || {};

            // Define mapping for vector uniform components
            const uniformPathMap = {
              "u_color1.x": { pathToValue: "u_color1.value.x" },
              "u_color1.y": { pathToValue: "u_color1.value.y" },
              "u_color1.z": { pathToValue: "u_color1.value.z" },
              "u_color2.x": { pathToValue: "u_color2.value.x" },
              "u_color2.y": { pathToValue: "u_color2.value.y" },
              "u_color2.z": { pathToValue: "u_color2.value.z" },
              u_rampStart: { pathToValue: "u_rampStart.value" },
              u_rampEnd: { pathToValue: "u_rampEnd.value" },
              u_rampGamma: { pathToValue: "u_rampGamma.value" },
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

            // Use the shared uniform update utility
            updateShaderUniforms(state, shader, expressions, uniformPathMap);
          },
        };
      });
  }, [textureDataMap, targets, updateShaderUniforms]);
};
