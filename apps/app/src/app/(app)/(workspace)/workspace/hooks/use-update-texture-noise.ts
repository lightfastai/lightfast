import type * as THREE from "three";
import { useMemo, useRef } from "react";

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

import { useTextureRenderStore } from "../providers/texture-render-store-provider";
import { useConnectionCache } from "./use-connection-cache";
import { useExpressionEvaluator } from "./use-expression-evaluator";
import { useShaderCache } from "./use-shader-cache";

export interface UpdateTextureNoiseProps {
  textureDataMap: Record<string, Texture>;
}

export const useUpdateTextureNoise = ({
  textureDataMap,
}: UpdateTextureNoiseProps): WebGLRenderTargetNode[] => {
  const { targets } = useTextureRenderStore((state) => state);
  const { createShader, getShader, hasShader } = useShaderCache();
  const { getSourceForTarget } = useConnectionCache();
  const expressionsRef = useRef<Record<string, Record<string, string>>>({});
  const { updateShaderUniforms } = useExpressionEvaluator();

  return useMemo(() => {
    return Object.entries(textureDataMap).map(([id]) => {
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

      let shader: THREE.ShaderMaterial;

      // Check if shader exists in cache
      if (hasShader(id)) {
        // Get existing shader from cache
        shader = getShader(id)!;
      } else {
        // Create a new shader and add to cache
        shader = createShader(id, () => {
          // First create default uniforms from the schema with default values
          const defaultValues = createDefaultPerlinNoise2D();
          const baseUniforms = createUniformsFromSchema(
            defaultValues,
            PNOISE_UNIFORM_CONSTRAINTS,
          );

          // Create the shader with initial uniforms
          const material = createShaderMaterial(
            baseVertexShader,
            pnoiseFragmentShader,
            baseUniforms,
          );

          // Apply actual values from the texture data
          // This ensures the shader starts with the right values
          updateUniforms(material, u, PNOISE_UNIFORM_CONSTRAINTS);

          return material;
        });
      }

      return {
        id,
        shader,
        onEachFrame: (state: WebGLRootState) => {
          // // Get expressions for this node
          // const expressions = expressionsRef.current[id] || {};
          // // Update textures from connections
          // const sourceId = getSourceForTarget(id);
          // if (shader.uniforms.u_texture1) {
          //   shader.uniforms.u_texture1.value = sourceId
          //     ? targets[sourceId]?.texture
          //     : null;
          // }
          // // Update uniforms using the Zod schema
          // updateUniforms(shader, u, PNOISE_UNIFORM_CONSTRAINTS);
          // // Use the shared uniform update utility for expressions
          // updateShaderUniforms(state, shader, expressions, {
          //   "u_scale.x": { pathToValue: "u_scale.value.x" },
          //   "u_scale.y": { pathToValue: "u_scale.value.y" },
          //   "u_translate.x": { pathToValue: "u_translate.value.x" },
          //   "u_translate.y": { pathToValue: "u_translate.value.y" },
          //   "u_rotation.x": { pathToValue: "u_rotation.value.x" },
          //   "u_rotation.y": { pathToValue: "u_rotation.value.y" },
          // });
        },
      };
    });
  }, [textureDataMap, createShader, getShader, hasShader]);
};
