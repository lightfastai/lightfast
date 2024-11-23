"use client";

import { useMemo, useRef } from "react";
import * as THREE from "three";

import { useRenderTargetPipeline } from "../../hooks/use-texture-render-pipeline";
import { useUpdateTextureLimit } from "../../hooks/use-update-texture-limit";
import { useUpdateTextureNoise } from "../../hooks/use-update-texture-noise";
import { createWebGLPortal, WebGLView } from "./webgl-primitives";

export const TextureRenderPipeline = () => {
  const meshRefs = useRef<Record<string, THREE.Mesh>>({});
  const noiseNodes = useUpdateTextureNoise();
  const limitNodes = useUpdateTextureLimit();
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
      {createWebGLPortal(
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
      <WebGLView.Port />
    </>
  );
};
