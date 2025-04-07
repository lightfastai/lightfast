import { useMemo, useRef } from "react";
import * as THREE from "three";

import type { WebGLRenderTargetNode, WebGLRootState } from "@repo/threejs";
import type { NoiseTexture, Texture } from "@vendor/db/types";
import {
  baseVertexShader,
  isExpression,
  pnoiseFragmentShader,
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
        const storeExpression = (key: string, value: any) => {
          if (isExpression(value)) {
            expressionsRef.current[id]![key] = value;
          }
        };

        storeExpression("u_period", u.u_period);
        storeExpression("u_harmonic_gain", u.u_harmonic_gain);
        storeExpression("u_harmonic_spread", u.u_harmonic_spread);
        storeExpression("u_amplitude", u.u_amplitude);
        storeExpression("u_offset", u.u_offset);
        storeExpression("u_exponent", u.u_exponent);
        storeExpression("u_scale.x", u.u_scale.x);
        storeExpression("u_scale.y", u.u_scale.y);
        storeExpression("u_translate.x", u.u_translate.x);
        storeExpression("u_translate.y", u.u_translate.y);
        storeExpression("u_rotation.x", u.u_rotation.x);
        storeExpression("u_rotation.y", u.u_rotation.y);

        // Initialize uniforms with either numeric values or placeholders for expressions
        const uniforms = {
          u_period: {
            value: typeof u.u_period === "number" ? u.u_period : 2.0,
          },
          u_harmonics: { value: u.u_harmonics },
          u_harmonic_gain: {
            value:
              typeof u.u_harmonic_gain === "number" ? u.u_harmonic_gain : 0.66,
          },
          u_harmonic_spread: {
            value:
              typeof u.u_harmonic_spread === "number"
                ? u.u_harmonic_spread
                : 2.0,
          },
          u_scale: {
            value: new THREE.Vector2(
              typeof u.u_scale.x === "number" ? u.u_scale.x : 1,
              typeof u.u_scale.y === "number" ? u.u_scale.y : 1,
            ),
          },
          u_translate: {
            value: new THREE.Vector2(
              typeof u.u_translate.x === "number" ? u.u_translate.x : 0,
              typeof u.u_translate.y === "number" ? u.u_translate.y : 0,
            ),
          },
          u_rotation: {
            value: new THREE.Vector2(
              typeof u.u_rotation.x === "number" ? u.u_rotation.x : 0,
              typeof u.u_rotation.y === "number" ? u.u_rotation.y : 0,
            ),
          },
          u_amplitude: {
            value: typeof u.u_amplitude === "number" ? u.u_amplitude : 0.84,
          },
          u_texture1: {
            value: null,
          },
          u_offset: {
            value: typeof u.u_offset === "number" ? u.u_offset : 0.412,
          },
          u_exponent: {
            value: typeof u.u_exponent === "number" ? u.u_exponent : 0.63,
          },
        };

        const shader = new THREE.ShaderMaterial({
          vertexShader: baseVertexShader,
          fragmentShader: pnoiseFragmentShader,
          uniforms: { ...uniforms },
        });

        return {
          id,
          shader,
          onEachFrame: (state: WebGLRootState) => {
            // Get expressions for this node
            const expressions = expressionsRef.current[id] || {};

            // Define mapping for vector uniform components
            const uniformPathMap = {
              "u_scale.x": { pathToValue: "u_scale.value.x" },
              "u_scale.y": { pathToValue: "u_scale.value.y" },
              "u_translate.x": { pathToValue: "u_translate.value.x" },
              "u_translate.y": { pathToValue: "u_translate.value.y" },
              "u_rotation.x": { pathToValue: "u_rotation.value.x" },
              "u_rotation.y": { pathToValue: "u_rotation.value.y" },
            };

            // Use the shared uniform update utility
            updateShaderUniforms(state, shader, expressions, uniformPathMap);
          },
        };
      });
  }, [textureDataMap, updateShaderUniforms]);
};
