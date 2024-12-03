"use client";

import type { Mesh } from "three";
import { memo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Vector3 } from "three";

import { Geometry } from "@dahlia/db/tenant/schema";

import { GeometryMap } from "./webgl-globals";

export const GeometryRenderer = memo(({ geometry }: { geometry: Geometry }) => {
  const meshRef = useRef<Mesh>(null);

  useFrame((state) => {
    if (!meshRef.current) return;
    const rotation = geometry.rotation;
    meshRef.current.rotation.set(
      rotation.x * state.clock.elapsedTime * 10,
      rotation.y * state.clock.elapsedTime * 10,
      rotation.z * state.clock.elapsedTime * 10,
    );
  });

  return (
    <mesh
      position={
        new Vector3(
          geometry.position.x,
          geometry.position.y,
          geometry.position.z,
        )
      }
      geometry={GeometryMap[geometry.type]}
      scale={new Vector3(geometry.scale.x, geometry.scale.y, geometry.scale.z)}
      ref={meshRef}
    >
      <meshBasicMaterial wireframe={geometry.wireframe} />
    </mesh>
  );
});
