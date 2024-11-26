import { useMemo } from "react";
import * as THREE from "three";

import {
  limitFragmentShader,
  limitVertexShader,
} from "@repo/webgl/shaders/limit/limit.glsl";

import { api } from "~/trpc/react";
import {
  LimitTexture,
  Texture,
} from "../../../../../../../../../../packages/db/dist/app/src/schema";
import { WebGLRootState } from "../components/webgl/webgl-primitives";
import { useTextureRenderStore } from "../providers/texture-render-store-provider";
import { TextureRenderNode } from "../types/render";

export const useUpdateTextureLimit = (): TextureRenderNode[] => {
  const { targets } = useTextureRenderStore((state) => state);
  const queries = api.useQueries((t) =>
    Object.entries(targets).map(([id, texture]) =>
      t.node.data.get<Texture>({
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
        return texture?.type === "Limit";
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
