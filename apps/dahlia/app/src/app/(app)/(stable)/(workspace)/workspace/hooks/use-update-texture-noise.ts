import { useMemo } from "react";
import * as THREE from "three";

import { NoiseTexture, Texture } from "@repo/db/schema";
import {
  perlinNoise3DFragmentShader,
  perlinNoise3DVertexShader,
} from "@repo/webgl/shaders/pnoise/pnoise.glsl";

import { api } from "~/trpc/react";
import { WebGLRootState } from "../components/webgl/webgl-primitives";
import { useTextureRenderStore } from "../providers/texture-render-store-provider";
import { TextureRenderNode } from "../types/render";

export const useUpdateTextureNoise = (): TextureRenderNode[] => {
  const { targets } = useTextureRenderStore((state) => state);
  const queries = api.useQueries((t) =>
    Object.entries(targets).map(([id, texture]) =>
      t.node.data.get<Texture>({
        id,
      }),
    ),
  );

  return useMemo(() => {
    // Create a map of query results with their IDs
    const textureDataMap = Object.entries(targets).reduce<
      Record<string, Texture>
    >((acc, [id], index) => {
      if (queries[index]?.data) {
        acc[id] = queries[index].data;
        return acc;
      } else {
        return acc;
      }
    }, {});

    return Object.entries(textureDataMap)
      .filter((entry): entry is [string, NoiseTexture] => {
        const [_, texture] = entry;
        return texture?.type === "Noise";
      })
      .map(([id, texture]) => {
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
          u_rotation: {
            value: new THREE.Vector2(u.u_rotation.x, u.u_rotation.y),
          },
          u_amplitude: { value: u.u_amplitude },
          u_texture: {
            value: null,
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
          id,
          shader,
          onEachFrame: (_: WebGLRootState) => {
            // uniforms.u_time.value = state.clock.elapsedTime;
          },
        };
      });
  }, [queries, targets]);
};
