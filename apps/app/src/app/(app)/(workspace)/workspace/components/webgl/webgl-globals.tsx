"use client";

import { Vector3 } from "three";

import { DefaultCamera, DefaultControls } from "@repo/webgl/components";
import {
  GeometryMap,
  GlobalBoxGeometry,
  GlobalPlaneGeometry,
  GlobalSphereGeometry,
  GlobalTetrahedronGeometry,
  GlobalTorusGeometry,
} from "@repo/webgl/utils";

// Legacy components for backward compatibility
export const GlobalPerspectiveCamera = (
  <DefaultCamera position={new Vector3(5, 2, 5)} />
);

export const GlobalOrbitControls = (
  <DefaultControls
    enableDamping
    dampingFactor={1.5}
    target={new Vector3(0, 0, 0)}
  />
);

// Re-export all the geometries and maps from the webgl package
export {
  GeometryMap,
  GlobalBoxGeometry,
  GlobalSphereGeometry,
  GlobalTetrahedronGeometry,
  GlobalTorusGeometry,
  GlobalPlaneGeometry,
};
