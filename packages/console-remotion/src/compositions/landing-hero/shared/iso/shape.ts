import type { Box3D, Face, Polygon, Shape, Bounds } from "./types";
import {
  project,
  ensureCW,
  clipPolygon,
  signedArea,
  faceToPath,
  polyBounds,
} from "./math";

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

function silhouette(b: Box3D): Polygon {
  return ensureCW([
    project(b.x, b.y, b.z + b.d),
    project(b.x + b.w, b.y, b.z + b.d),
    project(b.x + b.w, b.y, b.z),
    project(b.x + b.w, b.y + b.h, b.z),
    project(b.x, b.y + b.h, b.z),
    project(b.x, b.y + b.h, b.z + b.d),
  ]);
}

// ── AABB intersection ────────────────────────────────────

function aabbHit(a: Box3D, b: Box3D): Box3D | null {
  const x = Math.max(a.x, b.x);
  const y = Math.max(a.y, b.y);
  const z = Math.max(a.z, b.z);
  const mx = Math.min(a.x + a.w, b.x + b.w);
  const my = Math.min(a.y + a.h, b.y + b.h);
  const mz = Math.min(a.z + a.d, b.z + b.d);
  if (mx <= x || my <= y || mz <= z) return null;
  return { x, y, z, w: mx - x, h: my - y, d: mz - z };
}

// ── Inner faces revealed by subtraction ──────────────────
// When B is subtracted from A, the cavity exposes three inner
// surfaces (the ones whose outward normals face the viewer):
//   bottom floor  (z = int.z,      normal +z → renders like "top")
//   back wall     (y = int.y+int.h, normal -y → renders like "front")
//   left wall     (x = int.x,      normal +x → renders like "right")

function innerFaces(a: Box3D, b: Box3D): Face[] {
  const int = aabbHit(a, b);
  if (!int) return [];
  const out: Face[] = [];

  // Bottom floor — only if cavity does not punch through A's bottom
  if (int.z > a.z) {
    const c = ensureCW([
      project(int.x, int.y, int.z),
      project(int.x + int.w, int.y, int.z),
      project(int.x + int.w, int.y + int.h, int.z),
      project(int.x, int.y + int.h, int.z),
    ]);
    if (c.length >= 3 && Math.abs(signedArea(c)) > 0.01)
      out.push({ contour: c, holes: [], type: "top" });
  }

  // Front wall — only if cavity does not punch through A's front
  if (int.y > a.y) {
    const c = ensureCW([
      project(int.x, int.y, int.z),
      project(int.x + int.w, int.y, int.z),
      project(int.x + int.w, int.y, int.z + int.d),
      project(int.x, int.y, int.z + int.d),
    ]);
    if (c.length >= 3 && Math.abs(signedArea(c)) > 0.01)
      out.push({ contour: c, holes: [], type: "front" });
  }

  // Left wall — only if cavity does not punch through A's left
  if (int.x > a.x) {
    const c = ensureCW([
      project(int.x, int.y, int.z),
      project(int.x, int.y + int.h, int.z),
      project(int.x, int.y + int.h, int.z + int.d),
      project(int.x, int.y, int.z + int.d),
    ]);
    if (c.length >= 3 && Math.abs(signedArea(c)) > 0.01)
      out.push({ contour: c, holes: [], type: "right" });
  }

  return out;
}

// ── Clip a face, adding a hole where it overlaps `sil` ───

function clipFace(face: Face, sil: Polygon): Face {
  const hole = clipPolygon(face.contour, sil);
  if (hole.length < 3 || Math.abs(signedArea(hole)) < 0.01) return face;
  return { ...face, holes: [...face.holes, hole] };
}

// ── Public API ───────────────────────────────────────────

/** Create a shape from a single box */
export function createBox(b: Box3D): Shape {
  // Render order: right (deepest) → front → top (closest)
  return { faces: [rightFace(b), frontFace(b), topFace(b)] };
}

/** A minus B — carves B out of A */
function _subtract(a: Box3D, b: Box3D): Shape {
  if (!aabbHit(a, b)) return createBox(a);

  const bSil = silhouette(b);
  const outer = createBox(a).faces.map((f) => clipFace(f, bSil));
  const inner = innerFaces(a, b);

  // Inner faces first (behind), then outer faces with holes (in front)
  return { faces: [...inner, ...outer] };
}

/** A ∪ B — combined volume of both boxes */
function _union(a: Box3D, b: Box3D): Shape {
  if (!aabbHit(a, b)) {
    return { faces: [...createBox(a).faces, ...createBox(b).faces] };
  }

  const aSil = silhouette(a);
  const aFaces = createBox(a).faces;
  const bFaces = createBox(b).faces.map((f) => clipFace(f, aSil));

  // A's full faces, then B's faces with A's overlap removed
  return { faces: [...bFaces, ...aFaces] };
}

/** A ∩ B — only the overlapping volume */
function _intersect(a: Box3D, b: Box3D): Shape {
  const int = aabbHit(a, b);
  if (!int) return { faces: [] };
  return createBox(int);
}

// ── Render helpers ───────────────────────────────────────

/** SVG `d` attribute for a face (supports even-odd holes) */
export function facePath(face: Face): string {
  return faceToPath(face.contour, face.holes);
}

/** Bounding box of the entire shape in projected 2D */
export function shapeBounds(shape: Shape): Bounds {
  const all = shape.faces.flatMap((f) => f.contour);
  if (all.length === 0) return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  return polyBounds(all);
}

