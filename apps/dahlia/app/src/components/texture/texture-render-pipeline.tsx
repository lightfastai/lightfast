import type { RootState } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { View } from "@react-three/drei";
import { createPortal } from "@react-three/fiber";
import * as THREE from "three";

import { limitFragmentShader, limitVertexShader } from "@repo/webgl";
import {
  perlinNoise3DFragmentShader,
  perlinNoise3DVertexShader,
} from "@repo/webgl/shaders/pnoise";

import type { Texture } from "./types";
import { TDxMachineContext } from "~/app/(app)/(stable)/(network-editor)/state/context";
import { useRenderTargetPipeline } from "./use-texture-render-pipeline";

export const TextureRenderPipeline = () => {
  const textures = TDxMachineContext.useSelector(
    (state) => state.context.textures,
  );
  const meshRefs = useRef<Record<number, THREE.Mesh>>({});
  const rtargets = TDxMachineContext.useSelector(
    (state) => state.context.rtargets,
  );

  const noiseNodes = useMemo(() => {
    return Object.values(textures)
      .filter(
        (texture): texture is Extract<Texture, { type: "Noise" }> =>
          texture.type === "Noise",
      )
      .map((texture) => {
        const { uniforms: u } = texture;
        // Create unique uniform instances for each node
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

        // Create a new shader material instance for each node
        const shader = new THREE.ShaderMaterial({
          vertexShader: perlinNoise3DVertexShader,
          fragmentShader: perlinNoise3DFragmentShader,
          uniforms: { ...uniforms }, // Create a new uniform reference
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

  const limitNodes = useMemo(() => {
    return Object.values(textures)
      .filter(
        (texture): texture is Extract<Texture, { type: "Limit" }> =>
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
          onEachFrame: (_: RootState) => {
            // uniforms.u_time.value = state.clock.elapsedTime;
          },
        };
      });
  }, [rtargets, textures]);

  const updates = useMemo(
    () =>
      Object.fromEntries(
        [...noiseNodes, ...limitNodes].map((node) => [
          node.id,
          node.onEachFrame,
        ]),
      ),
    [noiseNodes, limitNodes],
  );

  const { scene, geometry } = useRenderTargetPipeline({
    onEachFrame: updates,
    meshes: meshRefs.current,
  });

  return (
    <>
      {createPortal(
        <>
          {noiseNodes.map(({ shader, id }) => (
            <mesh
              key={id}
              geometry={geometry}
              ref={(ref) => {
                if (ref) meshRefs.current[id] = ref;
              }}
            >
              <primitive object={shader} />
            </mesh>
          ))}
          {limitNodes.map(({ shader, id }) => (
            <mesh
              key={id}
              geometry={geometry}
              ref={(ref) => {
                if (ref) meshRefs.current[id] = ref;
              }}
            >
              <primitive object={shader} />
            </mesh>
          ))}
        </>,
        scene,
      )}
      <View.Port />
    </>
  );
};
