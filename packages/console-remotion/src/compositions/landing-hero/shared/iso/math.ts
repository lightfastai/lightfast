import type { Vec2, Polygon, Bounds } from "./types";

// ── Constants ────────────────────────────────────────────
const COS30 = Math.cos(Math.PI / 6); // √3/2 ≈ 0.866
const SIN30 = 0.5;
const EPS = 1e-9;

// ── Isometric projection ─────────────────────────────────
// x-axis → right-downward at 30°
// y-axis → left-downward at 30°
// z-axis → straight up
export function project(x: number, y: number, z: number): Vec2 {
  return [(x - y) * COS30, (x + y) * SIN30 - z];
}

// ── Signed area ──────────────────────────────────────────
// Positive = CW in screen coords (y-down). Negative = CCW.
export function signedArea(p: Polygon): number {
  let a = 0;
  const n = p.length;
  for (let i = 0; i < n; i++) {
    const pi = p[i]!;
    const pj = p[(i + 1) % n]!;
    a += pi[0] * pj[1] - pj[0] * pi[1];
  }
  return a * 0.5;
}

// ── Winding helpers ──────────────────────────────────────
export function ensureCW(p: Polygon): Polygon {
  return signedArea(p) < 0 ? [...p].reverse() : p;
}

export function ensureCCW(p: Polygon): Polygon {
  return signedArea(p) > 0 ? [...p].reverse() : p;
}

// ── Edge side test ───────────────────────────────────────
// Positive → p is to the right of directed edge a→b (screen coords, y-down)
function side(a: Vec2, b: Vec2, p: Vec2): number {
  return (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
}

// ── Line–line intersection ───────────────────────────────
function lineHit(p1: Vec2, p2: Vec2, p3: Vec2, p4: Vec2): Vec2 | null {
  const dx1 = p2[0] - p1[0],
    dy1 = p2[1] - p1[1];
  const dx2 = p4[0] - p3[0],
    dy2 = p4[1] - p3[1];
  const cross = dx1 * dy2 - dy1 * dx2;
  if (Math.abs(cross) < EPS) return null;
  const dx3 = p3[0] - p1[0],
    dy3 = p3[1] - p1[1];
  const t = (dx3 * dy2 - dy3 * dx2) / cross;
  return [p1[0] + t * dx1, p1[1] + t * dy1];
}

// ── Sutherland-Hodgman polygon clipping ──────────────────
// Clips `subject` against convex `clip`. Both must be CW (screen).
// Returns intersection polygon (CW) or empty array.
export function clipPolygon(subject: Polygon, clip: Polygon): Polygon {
  if (subject.length === 0 || clip.length === 0) return [];
  let out: Vec2[] = [...subject];

  for (let i = 0, cn = clip.length; i < cn; i++) {
    if (out.length === 0) return [];
    const inp = [...out];
    out = [];
    const a = clip[i]!;
    const b = clip[(i + 1) % cn]!;

    for (let j = 0, sn = inp.length; j < sn; j++) {
      const cur = inp[j]!;
      const prev = inp[(j + sn - 1) % sn]!;
      const curIn = side(a, b, cur) >= -EPS;
      const prevIn = side(a, b, prev) >= -EPS;

      if (curIn) {
        if (!prevIn) {
          const h = lineHit(prev, cur, a, b);
          if (h) out.push(h);
        }
        out.push(cur);
      } else if (prevIn) {
        const h = lineHit(prev, cur, a, b);
        if (h) out.push(h);
      }
    }
  }
  return out;
}

// ── Point-in-polygon (ray cast) ──────────────────────────
export function pointInPolygon(pt: Vec2, poly: Polygon): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const pi = poly[i]!;
    const pj = poly[j]!;
    if (pi[1] > pt[1] !== pj[1] > pt[1] && pt[0] < ((pj[0] - pi[0]) * (pt[1] - pi[1])) / (pj[1] - pi[1]) + pi[0]) {
      inside = !inside;
    }
  }
  return inside;
}

// ── SVG path generation ──────────────────────────────────
export function polygonToPath(p: Polygon): string {
  if (p.length === 0) return "";
  return (
    p.map((v, i) => `${i === 0 ? "M" : "L"}${v[0].toFixed(2)},${v[1].toFixed(2)}`).join(" ") +
    " Z"
  );
}

/** Builds an SVG path with even-odd holes */
export function faceToPath(contour: Polygon, holes: Polygon[]): string {
  const outer = polygonToPath(ensureCW(contour));
  if (holes.length === 0) return outer;
  const inner = holes.map((h) => polygonToPath(ensureCCW(h))).join(" ");
  return `${outer} ${inner}`;
}

// ── Bounds ───────────────────────────────────────────────
export function polyBounds(p: Polygon): Bounds {
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const v of p) {
    if (v[0] < minX) minX = v[0];
    if (v[0] > maxX) maxX = v[0];
    if (v[1] < minY) minY = v[1];
    if (v[1] > maxY) maxY = v[1];
  }
  return { minX, minY, maxX, maxY };
}

export function mergeBounds(list: Bounds[]): Bounds {
  return {
    minX: Math.min(...list.map((b) => b.minX)),
    minY: Math.min(...list.map((b) => b.minY)),
    maxX: Math.max(...list.map((b) => b.maxX)),
    maxY: Math.max(...list.map((b) => b.maxY)),
  };
}
