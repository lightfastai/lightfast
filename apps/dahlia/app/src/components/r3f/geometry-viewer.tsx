"use client";

import { OrbitControls, PerspectiveCamera } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { Vector3 } from "three";

import type { Vec3 } from "@repo/webgl";

import type { Geometry } from "../../app/(app)/(stable)/(workspace)/workspace/types/primitives";
import { GeometryRenderer } from "./geometry-renderer";

export const GeometryViewer = ({
  geometries,
  cameraPosition,
  lookAt,
  shouldRender = true, // @note takes precedence over other render props.
  shouldRenderGrid = true,
  shouldRenderAxes = false,
}: {
  geometries: Geometry[];
  cameraPosition: Vec3;
  lookAt: Vec3;
  shouldRenderGrid: boolean;
  shouldRenderAxes: boolean;
  shouldRender: boolean;
}) => {
  if (!shouldRender) return null;

  return (
    <Canvas>
      <PerspectiveCamera
        makeDefault
        position={
          new Vector3(cameraPosition.x, cameraPosition.y, cameraPosition.z)
        }
      />
      <OrbitControls
        enableDamping
        dampingFactor={1.5}
        target={new Vector3(lookAt.x, lookAt.y, lookAt.z)}
      />

      {shouldRenderGrid && <gridHelper args={[50, 100, "white", "gray"]} />}
      {shouldRenderAxes && <axesHelper args={[50]} />}
      {geometries.map((geometry) => (
        <GeometryRenderer key={geometry.id} geometry={geometry} />
      ))}

      <ambientLight intensity={0.5} />
      <pointLight position={[10, 10, 10]} />
    </Canvas>
  );
};
