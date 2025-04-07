"use client";

import type { Mesh } from "three";
import { memo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

import type { GeometryType } from "../../types/geometry";
import { GeometryMap } from "../../types/geometry";

export interface GeometryRendererProps {
  type: GeometryType;
  position?: THREE.Vector3;
  rotation?: THREE.Vector3;
  scale?: THREE.Vector3;
  wireframe?: boolean;
  animate?: boolean;
}

export const GeometryRenderer = memo(
  ({
    type,
    position = new THREE.Vector3(),
    rotation = new THREE.Vector3(),
    scale = new THREE.Vector3(),
    wireframe = false,
    animate = true,
  }: GeometryRendererProps) => {
    const meshRef = useRef<Mesh>(null);

    useFrame((state) => {
      if (!meshRef.current || !animate) return;
      meshRef.current.rotation.set(
        Number(rotation.x) * state.clock.elapsedTime * 10,
        Number(rotation.y) * state.clock.elapsedTime * 10,
        Number(rotation.z) * state.clock.elapsedTime * 10,
      );
    });

    return (
      <mesh
        position={
          new THREE.Vector3(
            Number(position.x),
            Number(position.y),
            Number(position.z),
          )
        }
        geometry={GeometryMap[type as keyof typeof GeometryMap]}
        scale={
          new THREE.Vector3(Number(scale.x), Number(scale.y), Number(scale.z))
        }
        ref={meshRef}
      >
        <meshBasicMaterial wireframe={wireframe} />
      </mesh>
    );
  },
);
