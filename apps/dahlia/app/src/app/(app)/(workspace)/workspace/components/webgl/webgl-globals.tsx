import { $GeometryType } from "@vendor/db/tenant/schema";
import {
  BoxGeometry,
  PlaneGeometry,
  SphereGeometry,
  TetrahedronGeometry,
  TorusGeometry,
  Vector3,
} from "three";

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
 * Parameters: radius, tube, radialSegments, tubularSegments
 * Reduced from (1, 0.4, 16, 100) to (1, 0.4, 12, 48)
 */
export const GlobalTorusGeometry = new TorusGeometry(1, 0.4, 12, 48);

/**
 * @description A box geometry.
 */
export const GlobalBoxGeometry = new BoxGeometry(1, 1, 1);

/**
 * @description A sphere geometry.
 * Parameters: radius, widthSegments, heightSegments
 * Reduced from (1, 32, 32) to (1, 16, 16)
 */
export const GlobalSphereGeometry = new SphereGeometry(1, 12, 12);

/**
 * @description A tetrahedron geometry.
 */
export const GlobalTetrahedronGeometry = new TetrahedronGeometry(1);

/**
 * @description A plane geometry.
 */
export const GlobalPlaneGeometry = new PlaneGeometry(2, 2);

// Create a static lookup map for geometries.
export const GeometryMap = {
  [$GeometryType.Enum.box]: GlobalBoxGeometry,
  [$GeometryType.Enum.sphere]: GlobalSphereGeometry,
  [$GeometryType.Enum.tetrahedron]: GlobalTetrahedronGeometry,
  [$GeometryType.Enum.torus]: GlobalTorusGeometry,
  [$GeometryType.Enum.plane]: GlobalPlaneGeometry,
} as const;
