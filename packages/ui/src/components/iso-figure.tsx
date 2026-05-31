import { LOGO_CURVE, lissajousPoints } from "@repo/ui/lib/brand";
import type { Box3D, Face, Vec2 } from "@repo/ui/lib/iso";
import {
  createBox,
  facePath,
  project,
  silhouette,
  subtract,
} from "@repo/ui/lib/iso";
import type React from "react";

// ── Design-language tokens ───────────────────────────────────────────
// The whole figure is a quiet blueprint on the border token (opaque bg fill →
// hidden-line occlusion). The etched Lissajous mark stays on the same border
// token as the structure — it reads as a mark through its heavier weight and
// round caps, not through contrast. Construction guides stay dashed.
//
// A section can opt into a foreground SILHOUETTE: the outer hexagonal outline
// of that box only, drawn over the quiet structure. Internal edges stay on the
// border token, so the boundary pops while the interior detail stays subtle —
// the Linear blueprint treatment.
//
// The etched mark and the structure share the border token AND the same line
// weight, so the logo reads as part of the same blueprint rather than a fatter
// overlay.
const FACE_FILL = "var(--background)";
const STRUCT = "var(--border)";
const ACCENT = "var(--border)";
const OUTLINE = "var(--foreground)";
const STRUCT_W = 1;
const ACCENT_W = STRUCT_W;
const OUTLINE_W = 1.5;

// Render boxes back-to-front so nearer faces occlude farther edges.
const depthKey = (b: Box3D) => b.x + b.w / 2 + (b.y + b.h / 2);
const byDepth = (a: Box3D, b: Box3D) => depthKey(a) - depthKey(b) || a.z - b.z;

interface Guide {
  a: [number, number, number];
  b: [number, number, number];
}

// The mark can be etched flat on a horizontal "top" face or on a vertical
// "front" face. `half` renders only the lower lobes (clipped at the logo's own
// horizontal midline) so the mark reads as emerging from a baseline.
type LogoEtch =
  | {
      face: "top";
      cx: number;
      cy: number;
      z: number;
      scale: number;
      half?: boolean;
    }
  | {
      face: "front";
      cx: number;
      cz: number;
      y: number;
      scale: number;
      half?: boolean;
    };

// Logo-space (px, py ∈ [-1, 1]) → its etch plane in 3D.
function logoWorld(
  etch: LogoEtch,
  px: number,
  py: number
): [number, number, number] {
  if (etch.face === "top") {
    return [etch.cx + etch.scale * px, etch.cy + etch.scale * py, etch.z];
  }
  return [etch.cx + etch.scale * px, etch.y, etch.cz + etch.scale * py];
}

const LOGO_SAMPLES: Vec2[] = lissajousPoints(
  LOGO_CURVE.a,
  LOGO_CURVE.b,
  LOGO_CURVE.delta,
  512
).slice(0, 512);

function loopPath(points: Vec2[]): string {
  return `${points
    .map(
      (v, i) => `${i === 0 ? "M" : "L"}${v[0].toFixed(2)},${v[1].toFixed(2)}`
    )
    .join(" ")} Z`;
}

// Projected polylines for the mark. Full curve → one closed loop. Half curve →
// the contiguous below-midline (py < 0) runs as open arcs, with each end snapped
// onto the exact py = 0 crossing so the cut sits cleanly on the baseline.
function logoSegments(etch: LogoEtch): { closed: boolean; pts: Vec2[] }[] {
  const proj = (px: number, py: number): Vec2 =>
    project(...logoWorld(etch, px, py));
  if (!etch.half) {
    return [
      { closed: true, pts: LOGO_SAMPLES.map(([px, py]) => proj(px, py)) },
    ];
  }
  const segs: Vec2[][] = [];
  let cur: Vec2[] | null = null;
  for (let i = 0; i < LOGO_SAMPLES.length; i++) {
    const [px, py] = LOGO_SAMPLES[i] as Vec2;
    const [ppx, ppy] = LOGO_SAMPLES[
      i === 0 ? LOGO_SAMPLES.length - 1 : i - 1
    ] as Vec2;
    if (py < 0) {
      if (!cur) {
        cur = [];
        if (ppy >= 0 && ppy !== py) {
          const f = ppy / (ppy - py); // crossing at py = 0
          cur.push(proj(ppx + (px - ppx) * f, 0));
        }
      }
      cur.push(proj(px, py));
    } else if (cur) {
      const f = ppy / (ppy - py);
      cur.push(proj(ppx + (px - ppx) * f, 0));
      segs.push(cur);
      cur = null;
    }
  }
  if (cur) {
    segs.push(cur);
  }
  return segs
    .filter((pts) => pts.length >= 2)
    .map((pts) => ({ closed: false, pts }));
}

function segPath({ closed, pts }: { closed: boolean; pts: Vec2[] }): string {
  const d = pts
    .map(
      (v, i) => `${i === 0 ? "M" : "L"}${v[0].toFixed(2)},${v[1].toFixed(2)}`
    )
    .join(" ");
  return closed ? `${d} Z` : d;
}

export interface IsoScene {
  boxes: Box3D[];
  guides?: Guide[];
  logo?: LogoEtch;
  /** Boxes whose outer silhouette is stroked in the foreground accent. */
  outlineBoxes?: Box3D[];
  /** Pre-built solids (e.g. a carved slab); `box` gives depth + bounds. */
  shapes?: { box: Box3D; faces: Face[] }[];
}

export const IsoFigure: React.FC<{ scene: IsoScene; width: number }> = ({
  scene,
  width,
}) => {
  const sortedBoxes = [...scene.boxes].sort(byDepth);
  const shapes = sortedBoxes.map(createBox);

  // Painter's-order draw list: a box's faces sort at its base z; an outline
  // sorts at the box's top (z + d), so it paints over the faces it wraps yet
  // is still occluded by any opaque box in front of it (e.g. the floating lid
  // hides the base silhouette behind it).
  const draws: { depth: number; level: number; node: React.ReactNode }[] = [];
  sortedBoxes.forEach((b, si) => {
    const shape = shapes[si];
    if (!shape) {
      return;
    }
    draws.push({
      depth: depthKey(b),
      level: b.z,
      node: shape.faces.map((face, fi) => (
        <path
          d={facePath(face)}
          fillRule="evenodd"
          key={`f-${si}-${fi}`}
          style={{
            fill: FACE_FILL,
            stroke: STRUCT,
            strokeWidth: STRUCT_W,
            strokeLinejoin: "miter",
          }}
        />
      )),
    });
  });
  scene.shapes?.forEach((s, si) => {
    draws.push({
      depth: depthKey(s.box),
      level: s.box.z,
      node: s.faces.map((face, fi) => (
        <path
          d={facePath(face)}
          fillRule="evenodd"
          key={`s-${si}-${fi}`}
          style={{
            fill: FACE_FILL,
            stroke: STRUCT,
            strokeWidth: STRUCT_W,
            strokeLinejoin: "miter",
          }}
        />
      )),
    });
  });
  scene.outlineBoxes?.forEach((b, i) => {
    draws.push({
      depth: depthKey(b),
      level: b.z + b.d,
      node: (
        <path
          d={loopPath(silhouette(b))}
          key={`o-${i}`}
          style={{
            fill: "none",
            stroke: OUTLINE,
            strokeWidth: OUTLINE_W,
            strokeLinejoin: "miter",
          }}
        />
      ),
    });
  });
  scene.guides?.forEach((g, i) => {
    const a = project(...g.a);
    const b = project(...g.b);
    // Depth by the guide's ground corner (x + y), so a guide behind the lid is
    // occluded by it while front/side guides stay on top.
    draws.push({
      depth: g.a[0] + g.a[1],
      level: g.a[2],
      node: (
        <line
          key={`g-${i}`}
          style={{
            stroke: STRUCT,
            strokeWidth: 1,
            strokeDasharray: "3 4",
          }}
          x1={a[0]}
          x2={b[0]}
          y1={a[1]}
          y2={b[1]}
        />
      ),
    });
  });
  draws.sort((p, q) => p.depth - q.depth || p.level - q.level);

  // Bounds across every face + the rendered logo points, so nothing clips.
  const logoDraw = scene.logo ? logoSegments(scene.logo) : [];
  const allPts: Vec2[] = [
    ...shapes.flatMap((s) => s.faces.flatMap((f) => f.contour)),
    ...(scene.shapes ?? []).flatMap((s) => s.faces.flatMap((f) => f.contour)),
    ...logoDraw.flatMap((s) => s.pts),
  ];
  let minX = Number.POSITIVE_INFINITY,
    minY = Number.POSITIVE_INFINITY,
    maxX = Number.NEGATIVE_INFINITY,
    maxY = Number.NEGATIVE_INFINITY;
  for (const [px, py] of allPts) {
    if (px < minX) {
      minX = px;
    }
    if (px > maxX) {
      maxX = px;
    }
    if (py < minY) {
      minY = py;
    }
    if (py > maxY) {
      maxY = py;
    }
  }
  const PAD = 8;
  const vx = minX - PAD;
  const vy = minY - PAD;
  const vw = maxX - minX + PAD * 2;
  const vh = maxY - minY + PAD * 2;
  const height = (width * vh) / vw;

  return (
    <svg height={height} viewBox={`${vx} ${vy} ${vw} ${vh}`} width={width}>
      {draws.map((d, i) => (
        <g key={`d-${i}`}>{d.node}</g>
      ))}

      {logoDraw.map((s, i) => (
        <path
          d={segPath(s)}
          key={`l-${i}`}
          style={{
            fill: "none",
            stroke: ACCENT,
            strokeWidth: ACCENT_W,
            strokeLinecap: "round",
            strokeLinejoin: "round",
          }}
        />
      ))}
    </svg>
  );
};

// ── Scenes ───────────────────────────────────────────────────────────
const U = 200;

/** Signals: layered base + floating lid with the Lissajous mark etched on top. */
export const signalsScene: IsoScene = (() => {
  // Every slab — the four in the base and the floating lid — shares one
  // thickness, so they read as the same unit.
  const slabD = 22;
  const lidD = slabD;
  const slabs = 5;
  const baseTop = slabs * slabD;
  const gap = 34;
  const lidZ = baseTop + gap;
  const boxes: Box3D[] = [];
  for (let i = 0; i < slabs; i++) {
    boxes.push({ x: 0, y: 0, z: i * slabD, w: U, h: U, d: slabD });
  }
  // Whole base treated as one section: outer silhouette spans all slabs.
  const base: Box3D = { x: 0, y: 0, z: 0, w: U, h: U, d: baseTop };
  const lid: Box3D = { x: 0, y: 0, z: lidZ, w: U, h: U, d: lidD };
  boxes.push(lid);
  const corners: [number, number][] = [
    [0, 0],
    [U, 0],
    [U, U],
    [0, U],
  ];
  return {
    boxes,
    guides: corners.map(([cx, cy]) => ({
      a: [cx, cy, baseTop],
      b: [cx, cy, lidZ],
    })),
    logo: { face: "top", cx: U / 2, cy: U / 2, z: lidZ + lidD, scale: 48 },
    outlineBoxes: [base, lid],
  };
})();

/**
 * People: an upright slab with a recessed pocket carved into the top-left of
 * the front face, and the Lightfast mark etched (bottom half only) centered on
 * that face. Same isometric projection as signals — just re-proportioned to
 * stand up, so the wide front face dominates.
 */
export const peopleScene: IsoScene = (() => {
  const W = 200; // width  (x)
  const T = 70; // thickness (y) — thin, so it reads as a standing slab
  const H = 235; // height (z) — upright
  const slab: Box3D = { x: 0, y: 0, z: 0, w: W, h: T, d: H };
  // Rectangular pocket inset into the top-left of the front face; the recess
  // runs more than half the slab thickness so the cavity walls read clearly.
  const pd = 40; // recess depth into the slab
  const pocket: Box3D = { x: 28, y: T - pd, z: 152, w: 68, h: pd, d: 56 };
  return {
    boxes: [],
    shapes: [{ box: slab, faces: subtract(slab, pocket).faces }],
    logo: { face: "front", cx: W / 2, cz: H / 2, y: T, scale: 64, half: true },
    outlineBoxes: [slab],
  };
})();
