import type * as THREE from "three";
import { useEffect, useMemo, useRef } from "react";

import type { WebGLRenderTargetNode, WebGLRootState } from "@repo/threejs";
import type { NoiseTexture, Texture } from "@vendor/db/types";
import {
  baseVertexShader,
  createDefaultPerlinNoise2D,
  createShaderMaterial,
  createUniformsFromSchema,
  isExpression,
  PNOISE_UNIFORM_CONSTRAINTS,
  pnoiseFragmentShader,
  updateUniforms,
} from "@repo/webgl";

import { useEdgeStore } from "../providers/edge-store-provider";
import { useTextureRenderStore } from "../providers/texture-render-store-provider";
import { useExpressionEvaluator } from "./use-expression-evaluator";

export interface UpdateTextureNoiseProps {
  textureDataMap: Record<string, Texture>;
}

export const useUpdateTextureNoise = ({
  textureDataMap,
}: UpdateTextureNoiseProps): WebGLRenderTargetNode[] => {
  const { targets } = useTextureRenderStore((state) => state);
  const { edges } = useEdgeStore((state) => state);
  // Cache of previously created shaders
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

  // Cleanup shaders when component unmounts
  useEffect(() => {
    return () => {
      Object.values(shaderCache.current).forEach((shader) => {
        shader.dispose();
      });
    };
  }, []);

  return useMemo(() => {
    return Object.entries(textureDataMap)
      .filter(([id]) => {
        // Make sure we have texture data for this ID and it's a Noise texture
        return textureDataMap[id] && textureDataMap[id].type === "Noise";
      })
      .map(([id]) => {
        // We know this is a NoiseTexture due to the filter above
        const texture = textureDataMap[id] as NoiseTexture;
        const { uniforms: u } = texture;

        // Ensure expressions cache exists for this ID
        expressionsRef.current[id] = expressionsRef.current[id] || {};

        // Store all expressions for this node
        Object.entries(u).forEach(([key, value]) => {
          if (typeof value === "object") {
            // Handle vec2 values
            if ("x" in value && "y" in value) {
              if (isExpression(value.x))
                expressionsRef.current[id]![`${key}.x`] = value.x;
              if (isExpression(value.y))
                expressionsRef.current[id]![`${key}.y`] = value.y;
            }
          } else if (isExpression(value)) {
            expressionsRef.current[id]![key] = value;
          }
        });

        if (!shaderCache.current[id]) {
          // First create default uniforms from the schema
          const baseUniforms = createUniformsFromSchema(
            createDefaultPerlinNoise2D(),
            PNOISE_UNIFORM_CONSTRAINTS,
          );

          // Create the shader with initial uniforms
          shaderCache.current[id] = createShaderMaterial(
            baseVertexShader,
            pnoiseFragmentShader,
            baseUniforms,
          );

          // Apply actual values from the texture data
          // This ensures the shader starts with the right values
          updateUniforms(
            shaderCache.current[id],
            u,
            PNOISE_UNIFORM_CONSTRAINTS,
          );
        }

        // Get cached shader
        const shader = shaderCache.current[id];

        return {
          id,
          shader,
          onEachFrame: (state: WebGLRootState) => {
            // Get expressions for this node
            const expressions = expressionsRef.current[id] || {};

            // Update textures from connections
            const sourceId = connectionCache.current[id];
            if (shader.uniforms.u_texture1) {
              shader.uniforms.u_texture1.value = sourceId
                ? targets[sourceId]?.texture
                : null;
            }

            // Update uniforms using the Zod schema
            updateUniforms(shader, u, PNOISE_UNIFORM_CONSTRAINTS);

            // Use the shared uniform update utility for expressions
            updateShaderUniforms(state, shader, expressions, {
              "u_scale.x": { pathToValue: "u_scale.value.x" },
              "u_scale.y": { pathToValue: "u_scale.value.y" },
              "u_translate.x": { pathToValue: "u_translate.value.x" },
              "u_translate.y": { pathToValue: "u_translate.value.y" },
              "u_rotation.x": { pathToValue: "u_rotation.value.x" },
              "u_rotation.y": { pathToValue: "u_rotation.value.y" },
            });
          },
        };
      });
  }, [textureDataMap, targets, updateShaderUniforms]);
};
