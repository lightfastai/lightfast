import { useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

import { TextureRenderPipeline } from "../types/texture";
import { useGetTextureData } from "./use-get-texture-data";

/**
 * @description A pipeline for rendering textures to render targets.
 */
export const useRenderTargetPipeline = ({
  onEachFrame,
  meshes,
}: TextureRenderPipeline) => {
  const { gl } = useThree();
  const { rtargets } = useGetTextureData();
  const scene = useMemo(() => new THREE.Scene(), []);
  const camera = useMemo(
    () => new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1),
    [],
  );
  const geometry = useMemo(() => new THREE.PlaneGeometry(2, 2), []);

  useFrame((state) => {
    Object.entries(rtargets).forEach(([key, target]) => {
      const run = onEachFrame[Number(key)];
      if (run) {
        run(state);
      }

      // Clear the scene and add only the relevant mesh
      scene.clear();
      const mesh = meshes[Number(key)];
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
    geometry,
  };
};
