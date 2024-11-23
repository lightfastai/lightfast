"use client";

import { useMemo, useRef } from "react";
import * as THREE from "three";

import {
  perlinNoise3DFragmentShader,
  perlinNoise3DVertexShader,
} from "@repo/webgl/shaders/pnoise/pnoise.glsl";

import { useRenderTargetPipeline } from "../../hooks/use-texture-render-pipeline";
import { useUpdateTextureNoise } from "../../hooks/use-update-texture-noise";
import { createWebGLPortal, WebGLView } from "./webgl-primitives";

export const TextureRenderPipeline = () => {
  const meshRefs = useRef<Record<string, THREE.Mesh>>({});
  const noiseNodes = useUpdateTextureNoise();
  const updates = useMemo(
    () =>
      Object.fromEntries(
        [...noiseNodes].map((node) => [node.id, node.onEachFrame]),
      ),
    [noiseNodes],
  );

  const { scene, geometry } = useRenderTargetPipeline({
    onEachFrame: updates,
    meshes: meshRefs.current,
  });

  return (
    <>
      {createWebGLPortal(
        <>
          {noiseNodes.map((value) => (
            <mesh
              key={value.id}
              geometry={geometry}
              ref={(ref) => {
                if (ref) meshRefs.current[value.id] = ref;
              }}
            >
              {/* <primitive object={shader} /> */}
              {/* <meshBasicMaterial map={shader.uniforms.u_texture.value} /> */}
              <shaderMaterial
                uniforms={value.shader.uniforms}
                vertexShader={perlinNoise3DVertexShader}
                fragmentShader={perlinNoise3DFragmentShader}
              />
            </mesh>
          ))}
          {/* {limitNodes.map(({ shader, id }) => (
            <mesh
              key={id}
              geometry={geometry}
              ref={(ref) => {
                if (ref) meshRefs.current[id] = ref;
              }}
            >
              <primitive object={shader} />
            </mesh>
          ))} */}
        </>,
        scene,
      )}
      <WebGLView.Port />
    </>
  );
};
