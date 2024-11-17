import type { RootState } from "@react-three/fiber";
import { useMemo } from "react";
import * as THREE from "three";

import {
  perlinNoise3DFragmentShader,
  perlinNoise3DVertexShader,
} from "@repo/webgl/shaders/pnoise";

import { TextureRenderNode } from "../types/texture";
import { useGetTextureData } from "./use-get-texture-data";

export const useUpdateTextureNoise = (): TextureRenderNode[] => {
  const { textures, rtargets } = useGetTextureData();

  return useMemo(() => {
    return Object.values(textures)
      .filter(
        (texture): texture is Extract<typeof texture, { type: "Noise" }> =>
          texture.type === "Noise",
      )
      .map((texture) => {
        const { uniforms: u } = texture;
        const uniforms = {
          u_period: { value: u.u_period },
          u_harmonics: { value: u.u_harmonics },
          u_harmonic_gain: { value: u.u_harmonic_gain },
          u_harmonic_spread: { value: u.u_harmonic_spread },
          u_scale: { value: new THREE.Vector2(u.u_scale.x, u.u_scale.y) },
          u_translate: {
            value: new THREE.Vector2(u.u_translate.x, u.u_translate.y),
          },
          u_amplitude: { value: u.u_amplitude },
          u_texture: {
            value: texture.input && rtargets[texture.input]?.texture,
          },
          u_offset: { value: u.u_offset },
          u_exponent: { value: u.u_exponent },
        };

        const shader = new THREE.ShaderMaterial({
          vertexShader: perlinNoise3DVertexShader,
          fragmentShader: perlinNoise3DFragmentShader,
          uniforms: { ...uniforms },
        });

        return {
          id: texture.id,
          shader,
          onEachFrame: (state: RootState) => {
            // uniforms.u_time.value = state.clock.elapsedTime;
          },
        };
      });
  }, [rtargets, textures]);
};
