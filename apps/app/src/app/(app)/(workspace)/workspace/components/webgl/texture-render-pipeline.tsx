"use client";

import type * as THREE from "three";
import { useMemo, useRef } from "react";

import { createWebGLPortal, WebGLView } from "@repo/webgl/components";
import { $GeometryType } from "@repo/webgl/utils";

import { useRenderTargetPipeline } from "../../hooks/use-render-target-pipeline-adapter";
import { useUpdateTextureAdd } from "../../hooks/use-update-texture-add";
import { useUpdateTextureDisplace } from "../../hooks/use-update-texture-displace";
import { useUpdateTextureLimit } from "../../hooks/use-update-texture-limit";
import { useUpdateTextureNoise } from "../../hooks/use-update-texture-noise";
import { GeometryMap } from "./webgl-globals";

export const TextureRenderPipeline = () => {
  const meshRefs = useRef<Record<string, THREE.Mesh>>({});
  const noiseNodes = useUpdateTextureNoise();
  const limitNodes = useUpdateTextureLimit();
  const displaceNodes = useUpdateTextureDisplace();
  const addNodes = useUpdateTextureAdd();

  // Get all nodes
  const allNodes = useMemo(
    () => [...noiseNodes, ...limitNodes, ...displaceNodes, ...addNodes],
    [noiseNodes, limitNodes, displaceNodes, addNodes],
  );

  // Create update handlers
  const updates = useMemo(() => {
    return allNodes.reduce(
      (acc, node) => {
        acc[node.id] = node.onEachFrame;
        return acc;
      },
      {} as Record<string, (state: any) => void>,
    );
  }, [allNodes]);

  // Use our adapter hook to connect to the existing store
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
