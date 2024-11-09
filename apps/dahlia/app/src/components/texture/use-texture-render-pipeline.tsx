import type { RootState } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

import { TDxMachineContext } from "~/machine/context";

// Custom hook for render target pipeline
export const useRenderTargetPipeline = ({
  onEachFrame,
  meshes,
}: {
  onEachFrame: Record<number, (state: RootState) => void>;
  meshes: Record<number, THREE.Mesh>;
}) => {
  const { gl } = useThree();
  const rtargets = TDxMachineContext.useSelector(
    (state) => state.context.rtargets,
  );
  const scene = useMemo(() => new THREE.Scene(), []);
  const camera = useMemo(
    () => new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1),
    [],
  );
  const geometry = useMemo(() => new THREE.PlaneGeometry(2, 2), []);

  const noiseMaterial = useRef();

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
    noiseMaterial,
    scene,
    geometry,
  };
};
