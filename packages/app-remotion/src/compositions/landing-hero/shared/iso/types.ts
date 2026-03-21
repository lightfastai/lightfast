/** 2D point [x, y] in screen coordinates (y-down) */
export type Vec2 = [number, number];

/** Ordered list of 2D points forming a closed polygon */
export type Polygon = Vec2[];

/** Visual face orientation for coloring */
export type FaceType = "top" | "front" | "right";

/** A projected 2D face with optional holes (from boolean subtraction) */
export interface Face {
  contour: Polygon;
  holes: Polygon[];
  type: FaceType;
}

/** A renderable shape: ordered collection of faces (back-to-front) */
export interface Shape {
  faces: Face[];
}

/** Axis-aligned 3D box: (x,y) = ground plane, z = vertical */
export interface Box3D {
  d: number; // extent along z (height)
  h: number; // extent along y
  w: number; // extent along x
  x: number;
  y: number;
  z: number;
}

/** 2D bounding rectangle */
export interface Bounds {
  maxX: number;
  maxY: number;
  minX: number;
  minY: number;
}
