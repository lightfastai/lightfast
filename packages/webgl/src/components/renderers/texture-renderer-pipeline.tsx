"use client";

import type { WebGLRenderTargetNode, WebGLRenderTargets } from "@/types/render";
import type { RootState } from "@react-three/fiber";
import type * as THREE from "three";
import { useMemo, useRef } from "react";

import { useTextureRenderPipeline } from "../../hooks/use-texture-render-pipeline";
import { $GeometryType, GeometryMap } from "../../types/geometry";
import { createWebGLPortal, WebGLView } from "../primitives/webgl-primitives";

export interface TextureRenderPipelineProps {
  targets: WebGLRenderTargets;
  nodes: WebGLRenderTargetNode[];
}

export const TextureRenderPipeline = ({
  targets,
  nodes,
}: TextureRenderPipelineProps) => {
  const meshRefs = useRef<Record<string, THREE.Mesh>>({});

  // Create update handlers from the provided nodes
  const updates = useMemo(() => {
    return nodes.reduce(
      (acc, node) => {
        acc[node.id] = node.onEachFrame;
        return acc;
      },
      {} as Record<string, (state: RootState) => void>,
    );
  }, [nodes]);

  // Use our adapter hook
  const { scene } = useTextureRenderPipeline({
    onEachFrame: updates,
    meshes: meshRefs.current,
    targets: targets,
  });

  return (
    <>
      {createWebGLPortal(
        <>
          {nodes.map(({ shader, id }) => (
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
