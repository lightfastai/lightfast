import type * as THREE from "three";
import { useRef } from "react";
import { useFrame } from "@react-three/fiber";

import type { NoiseShaderUniforms } from "./perlin-noise-material";
import { fragmentShader, vertexShader } from "./perlin-noise-material";

export const NoisePlane = ({ params }: { params: NoiseShaderUniforms }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);

  useFrame((state) => {
    if (!materialRef.current) return;

    if (!materialRef.current.uniforms.u_time) return;

    materialRef.current.uniforms.u_time.value = state.clock.elapsedTime;

    Object.entries(materialRef.current.uniforms).forEach(([key, value]) => {
      if (key === "u_time") return; // @todo why is this needed?
      if (!(key in params)) return;
      value.value = params[key];
    });
  });

  return (
    <mesh ref={meshRef}>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial
        ref={materialRef}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={{
          ...params,
        }}
      />
    </mesh>
  );
};
