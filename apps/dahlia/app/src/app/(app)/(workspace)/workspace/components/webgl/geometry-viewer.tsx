"use client";

import { useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { Vector3 } from "three";

import type { Vec3 } from "@repo/webgl";
import { Geometry } from "@dahlia/db/tenant/schema";

import { GeometryRenderer } from "./geometry-renderer";
import { OrbitControls, PerspectiveCamera } from "./webgl-primitives";

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
  const renderers = useMemo(() => {
    return geometries.map((geometry) => (
      <GeometryRenderer key={1} geometry={geometry} />
    ));
  }, [geometries]);

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
      {renderers}
      <ambientLight intensity={0.5} />
      <pointLight position={[10, 10, 10]} />
    </Canvas>
  );
};
