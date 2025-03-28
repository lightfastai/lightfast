import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

import { baseVertexShader } from "@repo/webgl/shaders/base-vert-shader";
import { displaceFragmentShader } from "@repo/webgl/shaders/displace";

import type { WebGLRootState } from "../components/webgl/webgl-primitives";
import type { TextureRenderNode } from "../types/render";
import type { DisplaceTexture, Texture } from "~/db/schema/types/Texture";
import { api } from "~/trpc/client/react";
import { useEdgeStore } from "../providers/edge-store-provider";
import { useTextureRenderStore } from "../providers/texture-render-store-provider";

export const useUpdateTextureDisplace = (): TextureRenderNode[] => {
  const { targets } = useTextureRenderStore((state) => state);
  const { edges } = useEdgeStore((state) => state);
  // Cache of previously created shaders to avoid recreating them
  const shaderCache = useRef<Record<string, THREE.ShaderMaterial>>({});
  // Cache of connections between nodes to input handles
  const connectionCache = useRef<Record<string, Record<string, string | null>>>(
    {},
  );

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

        // Reuse shader if available
        if (!shaderCache.current[id]) {
          shaderCache.current[id] = new THREE.ShaderMaterial({
            vertexShader: baseVertexShader,
            fragmentShader: displaceFragmentShader,
            uniforms: {
              u_texture1: { value: null }, // Source image
              u_texture2: { value: null }, // Displacement map
              u_displaceWeight: { value: u.u_displaceWeight },
              u_displaceMidpoint: {
                value: new THREE.Vector2(
                  u.u_displaceMidpoint.x,
                  u.u_displaceMidpoint.y,
                ),
              },
              u_displaceOffset: {
                value: new THREE.Vector2(
                  u.u_displaceOffset.x,
                  u.u_displaceOffset.y,
                ),
              },
              u_displaceOffsetWeight: { value: u.u_displaceOffsetWeight },
              u_displaceUVWeight: {
                value: new THREE.Vector2(
                  u.u_displaceUVWeight.x,
                  u.u_displaceUVWeight.y,
                ),
              },
            },
          });
        }

        // Update uniform values
        const shader = shaderCache.current[id];
        if (shader.uniforms.u_displaceWeight) {
          shader.uniforms.u_displaceWeight.value = u.u_displaceWeight;
        }
        if (shader.uniforms.u_displaceMidpoint) {
          shader.uniforms.u_displaceMidpoint.value = new THREE.Vector2(
            u.u_displaceMidpoint.x,
            u.u_displaceMidpoint.y,
          );
        }
        if (shader.uniforms.u_displaceOffset) {
          shader.uniforms.u_displaceOffset.value = new THREE.Vector2(
            u.u_displaceOffset.x,
            u.u_displaceOffset.y,
          );
        }
        if (shader.uniforms.u_displaceOffsetWeight) {
          shader.uniforms.u_displaceOffsetWeight.value =
            u.u_displaceOffsetWeight;
        }
        if (shader.uniforms.u_displaceUVWeight) {
          shader.uniforms.u_displaceUVWeight.value = new THREE.Vector2(
            u.u_displaceUVWeight.x,
            u.u_displaceUVWeight.y,
          );
        }

        return {
          id,
          shader,
          onEachFrame: (_: WebGLRootState) => {
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
          },
        };
      });
  }, [textureDataMap, targets]);
};
