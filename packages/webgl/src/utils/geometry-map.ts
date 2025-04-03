import {
  BoxGeometry,
  PlaneGeometry,
  SphereGeometry,
  TetrahedronGeometry,
  TorusGeometry,
} from "three";
import { z } from "zod";

// Define our own GeometryType enum to avoid dependency on db
export const $GeometryType = z.enum([
  "box",
  "sphere",
  "tetrahedron",
  "torus",
  "plane",
]);

export type GeometryType = z.infer<typeof $GeometryType>;

// Default positions
export const CENTER_OF_WORLD = { x: 0, y: 0, z: 0 };
export const WORLD_CAMERA_POSITION_CLOSE = { x: 5, y: 2, z: 5 };

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

// For compatibility with external geometry type enums
export const createGeometryMapAdapter = <T extends Record<string, string>>(
  externalEnum: T,
) => {
  return Object.fromEntries(
    Object.entries(externalEnum).map(([key, value]) => {
      const normalizedValue = value.toLowerCase();
      const matchedKey = Object.keys($GeometryType.Enum).find(
        (k) => k.toLowerCase() === normalizedValue,
      );
      if (!matchedKey) {
        throw new Error(
          `No matching geometry for external enum value: ${value}`,
        );
      }
      return [
        key,
        GeometryMap[
          $GeometryType.Enum[matchedKey as keyof typeof $GeometryType.Enum]
        ],
      ];
    }),
  );
};
