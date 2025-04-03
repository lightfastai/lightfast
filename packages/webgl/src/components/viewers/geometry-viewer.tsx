"use client";

import { useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { Vector3 } from "three";

import type { GeometryType } from "../../utils/geometry-map";
import type { GeometryRendererProps } from "../renderers/geometry-renderer";
import { DefaultCamera, DefaultControls } from "../primitives/camera-controls";
import { GeometryRenderer } from "../renderers/geometry-renderer";

export interface GeometryViewerProps {
  geometries: (Omit<GeometryRendererProps, "type"> & { type: GeometryType })[];
  cameraPosition?: { x: number; y: number; z: number };
  lookAt?: { x: number; y: number; z: number };
  shouldRender?: boolean;
  shouldRenderGrid?: boolean;
  shouldRenderAxes?: boolean;
}

export const GeometryViewer = ({
  geometries,
  cameraPosition,
  lookAt,
  shouldRender = true,
  shouldRenderGrid = true,
  shouldRenderAxes = false,
}: GeometryViewerProps) => {
  const renderers = useMemo(() => {
    return geometries.map((geometry, index) => (
      <GeometryRenderer key={index} {...geometry} />
    ));
  }, [geometries]);

  if (!shouldRender) return null;

  return (
    <Canvas>
      {cameraPosition && (
        <DefaultCamera
          position={
            new Vector3(cameraPosition.x, cameraPosition.y, cameraPosition.z)
          }
        />
      )}
      {lookAt && (
        <DefaultControls target={new Vector3(lookAt.x, lookAt.y, lookAt.z)} />
      )}

      {shouldRenderGrid && <gridHelper args={[50, 100, "white", "gray"]} />}
      {shouldRenderAxes && <axesHelper args={[50]} />}
      {renderers}
      <ambientLight intensity={0.5} />
      <pointLight position={[10, 10, 10]} />
    </Canvas>
  );
};
