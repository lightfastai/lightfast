"use client";

import type * as THREE from "three";
import { useEffect, useMemo, useRef } from "react";

import { $GeometryType } from "~/db/schema/types";
import { useRenderTargetPipeline } from "../../hooks/use-texture-render-pipeline";
import { useUpdateTextureAdd } from "../../hooks/use-update-texture-add";
import { useUpdateTextureDisplace } from "../../hooks/use-update-texture-displace";
import { useUpdateTextureLimit } from "../../hooks/use-update-texture-limit";
import { useUpdateTextureNoise } from "../../hooks/use-update-texture-noise";
import { GeometryMap } from "./webgl-globals";
import { createWebGLPortal, WebGLView } from "./webgl-primitives";

export const TextureRenderPipeline = () => {
  const meshRefs = useRef<Record<string, THREE.Mesh>>({});
  const noiseNodes = useUpdateTextureNoise();
  const limitNodes = useUpdateTextureLimit();
  const displaceNodes = useUpdateTextureDisplace();
  const addNodes = useUpdateTextureAdd();

  // clean up unused meshes
  useEffect(() => {
    const currentNodeIds = new Set([
      ...noiseNodes.map((node) => node.id),
      ...limitNodes.map((node) => node.id),
      ...displaceNodes.map((node) => node.id),
      ...addNodes.map((node) => node.id),
    ]);

    Object.keys(meshRefs.current).forEach((id) => {
      if (!currentNodeIds.has(id)) {
        delete meshRefs.current[id];
      }
    });
  }, [noiseNodes, limitNodes, displaceNodes, addNodes]);

  // update uniforms
  const updates = useMemo(
    () =>
      Object.fromEntries(
        [...noiseNodes, ...limitNodes, ...displaceNodes, ...addNodes].map(
          (node) => [node.id, node.onEachFrame],
        ),
      ),
    [noiseNodes, limitNodes, displaceNodes, addNodes],
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
          {displaceNodes.map(({ shader, id }) => (
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
          {addNodes.map(({ shader, id }) => (
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
