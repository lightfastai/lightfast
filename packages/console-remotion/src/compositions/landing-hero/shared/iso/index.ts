// Types
export type { Vec2, Polygon, Face, FaceType, Shape, Box3D, Bounds } from "./types";

// Projection
export { project } from "./math";

// Shape operations
export {
  createBox,
  subtract,
  union,
  intersect,
  silhouette,
  facePath,
  shapeBounds,
  mergeBounds,
} from "./shape";

// Low-level polygon math (for advanced use)
export { clipPolygon, signedArea, ensureCW, ensureCCW, polygonToPath, faceToPath } from "./math";
