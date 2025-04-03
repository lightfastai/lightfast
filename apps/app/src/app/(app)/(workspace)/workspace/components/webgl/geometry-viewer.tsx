"use client";

import type { Geometry } from "@vendor/db/types";
import { GeometryViewer as WebGLGeometryViewer } from "@repo/webgl/components";

export const GeometryViewer = ({
  geometries,
  cameraPosition,
  lookAt,
  shouldRender = true,
  shouldRenderGrid = true,
  shouldRenderAxes = false,
}: {
  geometries: Geometry[];
  cameraPosition: { x: number; y: number; z: number };
  lookAt: { x: number; y: number; z: number };
  shouldRenderGrid: boolean;
  shouldRenderAxes: boolean;
  shouldRender: boolean;
}) => {
  // Convert app-specific geometry objects to the format expected by the WebGL package
  const convertedGeometries = geometries.map((geometry) => ({
    type: geometry.type,
    position: geometry.position,
    rotation: geometry.rotation,
    scale: geometry.scale,
    wireframe: geometry.wireframe,
    animate: true,
  }));

  return (
    <WebGLGeometryViewer
      geometries={convertedGeometries}
      cameraPosition={cameraPosition}
      lookAt={lookAt}
      shouldRender={shouldRender}
      shouldRenderGrid={shouldRenderGrid}
      shouldRenderAxes={shouldRenderAxes}
    />
  );
};
