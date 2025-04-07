import { useMemo, useRef } from "react";

import type { WebGLRenderTargetNode, WebGLRootState } from "@repo/threejs";
import type { NoiseTexture, Texture } from "@vendor/db/types";
import {
  $PerlinNoise2D,
  baseVertexShader,
  createShaderMaterial,
  createUniformsFromSchema,
  isExpression,
  PNOISE_UNIFORM_CONSTRAINTS,
  pnoiseFragmentShader,
  updateUniforms,
} from "@repo/webgl";

import { useExpressionEvaluator } from "./use-expression-evaluator";

export interface UpdateTextureNoiseProps {
  textureDataMap: Record<string, Texture>;
}

export const useUpdateTextureNoise = ({
  textureDataMap,
}: UpdateTextureNoiseProps): WebGLRenderTargetNode[] => {
  // Cache expressions
  const expressionsRef = useRef<Record<string, Record<string, string>>>({});
  // Use the shared expression evaluator
  const { updateShaderUniforms } = useExpressionEvaluator();

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

        // Create shader with uniforms using Zod schema
        const shader = createShaderMaterial(
          baseVertexShader,
          pnoiseFragmentShader,
          createUniformsFromSchema($PerlinNoise2D, PNOISE_UNIFORM_CONSTRAINTS),
        );

        return {
          id,
          shader,
          onEachFrame: (state: WebGLRootState) => {
            // Get expressions for this node
            const expressions = expressionsRef.current[id] || {};

            // Update uniforms using the Zod schema
            updateUniforms(shader, u, PNOISE_UNIFORM_CONSTRAINTS);

            // Use the shared uniform update utility for expressions
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
  }, [textureDataMap, updateShaderUniforms]);
};
