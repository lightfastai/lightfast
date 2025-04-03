"use client";

import type * as THREE from "three";
import { Fragment, useEffect, useMemo, useRef } from "react";

import { createWebGLPortal, WebGLView } from "@repo/webgl/components";

import { $GeometryType, GeometryMap } from "../../utils/geometry-map";

export interface TextureRenderPipelineProps {
  meshes: Record<string, { id: string; shader: THREE.ShaderMaterial }>;
  onEachFrame?: Record<string, (state: any) => void>;
  scene: THREE.Scene;
}

export const TextureRenderPipeline = ({
  meshes,
  scene,
}: TextureRenderPipelineProps) => {
  const meshRefs = useRef<Record<string, THREE.Mesh>>({});

  // clean up unused meshes
  useEffect(() => {
    const currentNodeIds = new Set(Object.keys(meshes));

    Object.keys(meshRefs.current).forEach((id) => {
      if (!currentNodeIds.has(id)) {
        delete meshRefs.current[id];
      }
    });
  }, [meshes]);

  const meshElements = useMemo(() => {
    return Object.entries(meshes).map(([id, { shader }]) => (
      <mesh
        key={id}
        geometry={GeometryMap[$GeometryType.Enum.plane]}
        ref={(ref) => {
          if (ref) meshRefs.current[id] = ref;
        }}
      >
        <primitive object={shader} />
      </mesh>
    ));
  }, [meshes]);

  return (
    <Fragment>
      {createWebGLPortal(<Fragment>{meshElements}</Fragment>, scene)}
      <WebGLView.Port />
    </Fragment>
  );
};
