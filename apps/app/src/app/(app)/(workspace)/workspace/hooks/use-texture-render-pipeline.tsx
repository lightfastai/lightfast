import { useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

import type { TextureRenderPipeline } from "../types/render";
import { useTextureRenderStore } from "../providers/texture-render-store-provider";

/**
 * @description A pipeline for rendering textures to render targets.
 */
export const useRenderTargetPipeline = ({
  onEachFrame,
  meshes,
}: TextureRenderPipeline) => {
  const { gl } = useThree();
  const { targets } = useTextureRenderStore((state) => state);
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
  };
};
