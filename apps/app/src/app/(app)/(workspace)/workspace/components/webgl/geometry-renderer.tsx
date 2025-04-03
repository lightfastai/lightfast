"use client";

import { memo } from "react";

import type { GeometryType } from "@repo/webgl/utils";
import type { Geometry } from "@vendor/db/types";
import { GeometryRenderer as WebGLGeometryRenderer } from "@repo/webgl/components";

// Convert vector properties from potentially string values to numbers
const convertVectorToNumbers = (vec: any) => {
  return {
    x: Number(vec.x),
    y: Number(vec.y),
    z: Number(vec.z),
  };
};

// This is a compatibility layer for the original GeometryRenderer
// that adapts to the new package's API
export const GeometryRenderer = memo(({ geometry }: { geometry: Geometry }) => {
  // Convert position, rotation, scale to ensure they are numbers
  const position = convertVectorToNumbers(geometry.position);
  const rotation = convertVectorToNumbers(geometry.rotation);
  const scale = convertVectorToNumbers(geometry.scale);

  return (
    <WebGLGeometryRenderer
      type={geometry.type as unknown as GeometryType}
      position={position}
      rotation={rotation}
      scale={scale}
      wireframe={geometry.wireframe}
      animate={true}
    />
  );
});
