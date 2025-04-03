"use client";

import type { Mesh } from "three";
import { memo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Vector3 } from "three";

import type { GeometryType } from "../../utils/geometry-map";
import { GeometryMap } from "../../utils/geometry-map";

export interface GeometryRendererProps {
  type: GeometryType;
  position?: { x: number; y: number; z: number };
  rotation?: { x: number; y: number; z: number };
  scale?: { x: number; y: number; z: number };
  wireframe?: boolean;
  animate?: boolean;
}

export const GeometryRenderer = memo(
  ({
    type,
    position = { x: 0, y: 0, z: 0 },
    rotation = { x: 0, y: 0, z: 0 },
    scale = { x: 1, y: 1, z: 1 },
    wireframe = false,
    animate = true,
  }: GeometryRendererProps) => {
    const meshRef = useRef<Mesh>(null);

    useFrame((state) => {
      if (!meshRef.current || !animate) return;
      meshRef.current.rotation.set(
        rotation.x * state.clock.elapsedTime * 10,
        rotation.y * state.clock.elapsedTime * 10,
        rotation.z * state.clock.elapsedTime * 10,
      );
    });

    return (
      <mesh
        position={new Vector3(position.x, position.y, position.z)}
        geometry={GeometryMap[type]}
        scale={new Vector3(scale.x, scale.y, scale.z)}
        ref={meshRef}
      >
        <meshBasicMaterial wireframe={wireframe} />
      </mesh>
    );
  },
);
