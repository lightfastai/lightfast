import { useMemo } from "react";
import * as THREE from "three";

import { Texture } from "@repo/db/schema";
import {
  limitFragmentShader,
  limitVertexShader,
} from "@repo/webgl/shaders/limit/limit.glsl";

import { api } from "~/trpc/react";
import { WebGLRootState } from "../components/webgl/webgl-primitives";
import { useTextureRenderStore } from "../providers/texture-render-store-provider";
import { TextureRenderNode } from "../types/render";

export const useUpdateTextureLimit = (): TextureRenderNode[] => {
  const { targets } = useTextureRenderStore((state) => state);
  const [textures] = api.useQueries((t) =>
    Object.entries(targets).map(([id, texture]) =>
      t.node.data.get<Texture>({
        id,
      }),
    ),
  );
  return useMemo(() => {
    return Object.values(textures?.data ?? {})
      .filter(
        (texture): texture is Extract<typeof texture, { type: "Limit" }> =>
          texture.type === "Limit",
      )
      .map((texture) => {
        const { uniforms: u } = texture;
        const uniforms = {
          u_texture: {
            value: texture.input && targets[texture.input]?.texture,
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
  }, [targets]);
};
