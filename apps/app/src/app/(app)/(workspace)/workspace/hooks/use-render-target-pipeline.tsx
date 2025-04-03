"use client";

import { useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

import type { WebGLRootState } from "../webgl";
import { useTextureRenderStore } from "../providers/texture-render-store-provider";

/**
 * Custom hook that adapts the existing texture render store to work with the WebGL package.
 * This is a direct implementation rather than using the generic adapter, to ensure
 * it works exactly like the original implementation.
 */
export const useRenderTargetPipeline = ({
  onEachFrame,
  meshes,
}: {
  onEachFrame: Record<string, (state: WebGLRootState) => void>;
  meshes: Record<string, THREE.Mesh>;
}) => {
  const { gl } = useThree();
  const { targets } = useTextureRenderStore((state) => state);
  const scene = useMemo(() => new THREE.Scene(), []);
  const camera = useMemo(
    () => new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1),
    [],
  );

  // This directly replicates the original implementation
  useFrame((state) => {
    Object.entries(targets).forEach(([key, target]) => {
      const run = onEachFrame[key];
      if (run) {
        run(state);
      }

      // Clear the scene and add only the relevant mesh
      scene.clear();
      const mesh = meshes[key];
      if (mesh) {
        scene.add(mesh);
      }

      gl.setRenderTarget(target);
      gl.render(scene, camera);

      // Reset render target
      gl.setRenderTarget(null);
    });
  });

  return {
    scene,
    camera,
  };
};
