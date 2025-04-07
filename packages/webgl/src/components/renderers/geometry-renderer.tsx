"use client";

import type { Mesh } from "three";
import { memo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Vector3 } from "three";

import type { GeometryType } from "../../types/geometry";
import type { Vec3 } from "../../types/shader-uniform";
import { GeometryMap } from "../../types/geometry";
import { createDefaultVec3 } from "../../types/shader-uniform";

export interface GeometryRendererProps {
  type: GeometryType;
  position?: Vec3;
  rotation?: Vec3;
  scale?: Vec3;
  wireframe?: boolean;
  animate?: boolean;
}

export const GeometryRenderer = memo(
  ({
    type,
    position = createDefaultVec3(),
    rotation = createDefaultVec3(),
    scale = createDefaultVec3(),
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
          new Vector3(
            Number(position.x),
            Number(position.y),
            Number(position.z),
          )
        }
        geometry={GeometryMap[type as keyof typeof GeometryMap]}
        scale={new Vector3(Number(scale.x), Number(scale.y), Number(scale.z))}
        ref={meshRef}
      >
        <meshBasicMaterial wireframe={wireframe} />
      </mesh>
    );
  },
);
