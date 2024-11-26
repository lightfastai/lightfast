"use client";

import type { Mesh } from "three";
import { memo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Vector3 } from "three";

import { $GeometryType, Geometry } from "@repo/db/schema";

export const GeometryRenderer = memo(({ geometry }: { geometry: Geometry }) => {
  const meshRef = useRef<Mesh>(null);

  let Geometry;
  switch (geometry.type) {
    case $GeometryType.Enum.box:
      Geometry = <boxGeometry />;
      break;
    case $GeometryType.Enum.sphere:
      Geometry = <sphereGeometry />;
      break;
    case $GeometryType.Enum.tetrahedron:
      Geometry = <tetrahedronGeometry />;
      break;
    /**
     * @note Only used for render of Material
     */
    case $GeometryType.Enum.torus:
      Geometry = <torusGeometry args={[1, 0.4, 16, 100]} />;
      break;
  }

  /**
   * @todo a more granular rotation; state.clock.elapsedTime is general and cant be controlled granularly.
   */
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
      scale={new Vector3(geometry.scale.x, geometry.scale.y, geometry.scale.z)}
      ref={meshRef}
    >
      {Geometry}
      <meshBasicMaterial wireframe={geometry.wireframe} />
    </mesh>
  );
});
