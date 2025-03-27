import { useMemo } from "react";
import * as THREE from "three";

import type { LimitTexture, Texture } from "@dahlia/db/tenant/schema";
import {
  limitFragmentShader,
  limitVertexShader,
} from "@repo/webgl/shaders/limit/limit.glsl";

import type { WebGLRootState } from "../components/webgl/webgl-primitives";
import type { TextureRenderNode } from "../types/render";
import { api } from "~/trpc/client/react";
import { useTextureRenderStore } from "../providers/texture-render-store-provider";

export const useUpdateTextureLimit = (): TextureRenderNode[] => {
  const { targets } = useTextureRenderStore((state) => state);
  const queries = api.useQueries((t) =>
    Object.entries(targets).map(([id, texture]) =>
      t.tenant.node.data.get<Texture>({
        id,
      }),
    ),
  );

  return useMemo(() => {
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
      .filter((entry): entry is [string, LimitTexture] => {
        const [_, texture] = entry;
        return texture.type === "Limit";
      })
      .map(([id, texture]) => {
        const { uniforms: u } = texture;
        const uniforms = {
          u_texture: {
            // value: texture.input && targets[texture.input]?.texture,
            value: null,
          },
          u_quantizationSteps: { value: u.u_quantizationSteps },
        };

        const shader = new THREE.ShaderMaterial({
          vertexShader: limitVertexShader,
          fragmentShader: limitFragmentShader,
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
  }, [targets]);
};
