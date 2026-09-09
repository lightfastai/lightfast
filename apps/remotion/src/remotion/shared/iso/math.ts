import type { Bounds, Polygon, Vec2 } from "./types";

// ── Constants ────────────────────────────────────────────
const COS30 = Math.cos(Math.PI / 6); // √3/2 ≈ 0.866
const SIN30 = 0.5;

// ── Isometric projection ─────────────────────────────────
// x-axis → right-downward at 30°
// y-axis → left-downward at 30°
// z-axis → straight up
export function project(x: number, y: number, z: number): Vec2 {
  return [(x - y) * COS30, (x + y) * SIN30 - z];
}

// ── Signed area ──────────────────────────────────────────
// Positive = CW in screen coords (y-down). Negative = CCW.
function signedArea(p: Polygon): number {
  let a = 0;
  const n = p.length;
  for (let i = 0; i < n; i++) {
    const pi = p[i];
    const pj = p[(i + 1) % n];
    if (!(pi && pj)) {
      continue;
    }
    a += pi[0] * pj[1] - pj[0] * pi[1];
  }
  return a * 0.5;
}

// ── Winding helpers ──────────────────────────────────────
export function ensureCW(p: Polygon): Polygon {
  return signedArea(p) < 0 ? [...p].reverse() : p;
}

function ensureCCW(p: Polygon): Polygon {
  return signedArea(p) > 0 ? [...p].reverse() : p;
}

// ── SVG path generation ──────────────────────────────────
function polygonToPath(p: Polygon): string {
  if (p.length === 0) {
    return "";
  }
  return `${p
    .map(
      (v, i) => `${i === 0 ? "M" : "L"}${v[0].toFixed(2)},${v[1].toFixed(2)}`
    )
    .join(" ")} Z`;
}

/** Builds an SVG path with even-odd holes */
export function faceToPath(contour: Polygon, holes: Polygon[]): string {
  const outer = polygonToPath(ensureCW(contour));
  if (holes.length === 0) {
    return outer;
  }
  const inner = holes.map((h) => polygonToPath(ensureCCW(h))).join(" ");
  return `${outer} ${inner}`;
}

// ── Bounds ───────────────────────────────────────────────
export function polyBounds(p: Polygon): Bounds {
  let minX = Number.POSITIVE_INFINITY,
    minY = Number.POSITIVE_INFINITY,
    maxX = Number.NEGATIVE_INFINITY,
    maxY = Number.NEGATIVE_INFINITY;
  for (const v of p) {
    if (v[0] < minX) {
      minX = v[0];
    }
    if (v[0] > maxX) {
      maxX = v[0];
    }
    if (v[1] < minY) {
      minY = v[1];
    }
    if (v[1] > maxY) {
      maxY = v[1];
    }
  }
  return { minX, minY, maxX, maxY };
}
