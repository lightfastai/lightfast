"use client";

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

import { $GeometryType } from "../../../../../../../../../../../packages/db/dist/app/src/schema";
import { useRenderTargetPipeline } from "../../hooks/use-texture-render-pipeline";
import { useUpdateTextureLimit } from "../../hooks/use-update-texture-limit";
import { useUpdateTextureNoise } from "../../hooks/use-update-texture-noise";
import { GeometryMap } from "./webgl-globals";
import { createWebGLPortal, WebGLView } from "./webgl-primitives";

export const TextureRenderPipeline = () => {
  const meshRefs = useRef<Record<string, THREE.Mesh>>({});
  const noiseNodes = useUpdateTextureNoise();
  const limitNodes = useUpdateTextureLimit();

  // clean up unused meshes
  useEffect(() => {
    const currentNodeIds = new Set([
      ...noiseNodes.map((node) => node.id),
      ...limitNodes.map((node) => node.id),
    ]);

    Object.keys(meshRefs.current).forEach((id) => {
      if (!currentNodeIds.has(id)) {
        delete meshRefs.current[id];
      }
    });
  }, [noiseNodes, limitNodes]);

  // update uniforms
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

  const { scene } = useRenderTargetPipeline({
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
              geometry={GeometryMap[$GeometryType.Enum.plane]}
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
              geometry={GeometryMap[$GeometryType.Enum.plane]}
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
