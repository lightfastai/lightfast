import { ensureCW, faceToPath, polyBounds, project } from "./math";
import type { Bounds, Box3D, Face, Polygon, Shape } from "./types";

// ── Face constructors ────────────────────────────────────

function topFace(b: Box3D): Face {
  const z = b.z + b.d;
  return {
    contour: ensureCW([
      project(b.x, b.y, z),
      project(b.x + b.w, b.y, z),
      project(b.x + b.w, b.y + b.h, z),
      project(b.x, b.y + b.h, z),
    ]),
    holes: [],
    type: "top",
  };
}

function frontFace(b: Box3D): Face {
  // y=h plane (the "back" in 3D, but faces the viewer in iso projection)
  return {
    contour: ensureCW([
      project(b.x, b.y + b.h, b.z),
      project(b.x + b.w, b.y + b.h, b.z),
      project(b.x + b.w, b.y + b.h, b.z + b.d),
      project(b.x, b.y + b.h, b.z + b.d),
    ]),
    holes: [],
    type: "front",
  };
}

function rightFace(b: Box3D): Face {
  return {
    contour: ensureCW([
      project(b.x + b.w, b.y, b.z),
      project(b.x + b.w, b.y + b.h, b.z),
      project(b.x + b.w, b.y + b.h, b.z + b.d),
      project(b.x + b.w, b.y, b.z + b.d),
    ]),
    holes: [],
    type: "right",
  };
}

// ── Silhouette (hexagonal outline of isometric box) ──────

/** The outer hexagonal outline of an isometric box (no internal edges) */
export function silhouette(b: Box3D): Polygon {
  return ensureCW([
    project(b.x, b.y, b.z + b.d),
    project(b.x + b.w, b.y, b.z + b.d),
    project(b.x + b.w, b.y, b.z),
    project(b.x + b.w, b.y + b.h, b.z),
    project(b.x, b.y + b.h, b.z),
    project(b.x, b.y + b.h, b.z + b.d),
  ]);
}

// ── Public API ───────────────────────────────────────────

/** Create a shape from a single box */
export function createBox(b: Box3D): Shape {
  // Render order: right (deepest) → front → top (closest)
  return { faces: [rightFace(b), frontFace(b), topFace(b)] };
}

// ── Render helpers ───────────────────────────────────────

/** SVG `d` attribute for a face (supports even-odd holes) */
export function facePath(face: Face): string {
  return faceToPath(face.contour, face.holes);
}

/** Bounding box of the entire shape in projected 2D */
export function shapeBounds(shape: Shape): Bounds {
  const all = shape.faces.flatMap((f) => f.contour);
  if (all.length === 0) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  }
  return polyBounds(all);
}
