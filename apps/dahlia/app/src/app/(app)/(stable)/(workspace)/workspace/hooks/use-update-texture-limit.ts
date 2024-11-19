import { useMemo } from "react";
import * as THREE from "three";

import { limitFragmentShader, limitVertexShader } from "@repo/webgl";

import { WebGLRootState } from "../components/webgl/webgl-primitives";
import { TextureRenderNode } from "../types/render";
import { useGetTextureData } from "./use-get-texture-data";

export const useUpdateTextureLimit = (): TextureRenderNode[] => {
  const { textures, rtargets } = useGetTextureData();

  return useMemo(() => {
    return Object.values(textures)
      .filter(
        (texture): texture is Extract<typeof texture, { type: "Limit" }> =>
          texture.type === "Limit",
      )
      .map((texture) => {
        const { uniforms: u } = texture;
        const uniforms = {
          u_texture: {
            value: texture.input && rtargets[texture.input]?.texture,
          },
          u_quantizationSteps: { value: u.u_quantizationSteps },
        };

        const shader = new THREE.ShaderMaterial({
          vertexShader: limitVertexShader,
          fragmentShader: limitFragmentShader,
          uniforms: { ...uniforms },
        });

        return {
          id: texture.id,
          shader,
          onEachFrame: (_: WebGLRootState) => {
            // uniforms.u_time.value = state.clock.elapsedTime;
          },
        };
      });
  }, [rtargets, textures]);
};
