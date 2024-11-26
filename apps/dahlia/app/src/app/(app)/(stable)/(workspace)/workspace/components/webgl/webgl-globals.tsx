import { Vector3 } from "three";

import { $GeometryType } from "@repo/db/schema";

import {
  CENTER_OF_WORLD,
  WORLD_CAMERA_POSITION_CLOSE,
} from "../../stores/constants";
import { OrbitControls, PerspectiveCamera } from "./webgl-primitives";

export const GlobalPerspectiveCamera = (
  <PerspectiveCamera
    makeDefault
    position={
      new Vector3(
        WORLD_CAMERA_POSITION_CLOSE.x,
        WORLD_CAMERA_POSITION_CLOSE.y,
        WORLD_CAMERA_POSITION_CLOSE.z,
      )
    }
  />
);

export const GlobalOrbitControls = (
  <OrbitControls
    enableDamping
    dampingFactor={1.5}
    target={
      new Vector3(CENTER_OF_WORLD.x, CENTER_OF_WORLD.y, CENTER_OF_WORLD.z)
    }
  />
);

/**
 * @description A torus geometry.
 */
export const GlobalTorusGeometry = <torusGeometry args={[1, 0.4, 16, 100]} />;

/**
 * @description A box geometry.
 */
export const GlobalBoxGeometry = <boxGeometry />;

/**
 * @description A sphere geometry.
 */
export const GlobalSphereGeometry = <sphereGeometry />;

/**
 * @description A tetrahedron geometry.
 */
export const GlobalTetrahedronGeometry = <tetrahedronGeometry />;

// Create a static lookup map for geometries.
export const GeometryMap = {
  [$GeometryType.Enum.box]: GlobalBoxGeometry,
  [$GeometryType.Enum.sphere]: GlobalSphereGeometry,
  [$GeometryType.Enum.tetrahedron]: GlobalTetrahedronGeometry,
  [$GeometryType.Enum.torus]: GlobalTorusGeometry,
} as const;
