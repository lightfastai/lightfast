"use client";

import { useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

import type {
  TextureRenderPipeline,
  TextureRenderStore,
} from "../../types/render";

/**
 * @description A pipeline for rendering textures to render targets.
 * This hook requires a texture render store to be provided through context.
 */
export const useRenderTargetPipeline = ({
  onEachFrame,
  meshes,
}: TextureRenderPipeline) => {
  const { gl } = useThree();
  const scene = useMemo(() => new THREE.Scene(), []);
  const camera = useMemo(
    () => new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1),
    [],
  );

  // This needs to be connected to a texture render store
  // We'll provide an adapter function for apps to connect their own stores
  useFrame((state) => {
    // Implementation depends on the texture render store
    // which will be provided by the consuming application
  });

  return {
    scene,
    camera,
  };
};

/**
 * Creates an adapter for the render target pipeline that connects to a specific store
 */
export const createRenderTargetPipelineAdapter = (
  useStore: () => TextureRenderStore,
) => {
  return ({ onEachFrame, meshes }: TextureRenderPipeline) => {
    const { gl } = useThree();
    const { targets } = useStore();
    const scene = useMemo(() => new THREE.Scene(), []);
    const camera = useMemo(
      () => new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1),
      [],
    );

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
};
