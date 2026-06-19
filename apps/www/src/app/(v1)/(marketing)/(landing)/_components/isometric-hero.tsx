import {
  lissajousPoints as computeLissajousPoints,
  LOGO_CURVE,
} from "@repo/ui/lib/brand";
import type { Box3D, Vec2 } from "@repo/ui/lib/iso";
import { createBox, facePath, project, shapeBounds } from "@repo/ui/lib/iso";

const CANVAS_W = 1200;
const CANVAS_H = 675;

const BOX: Box3D = { x: 0, y: 0, z: 0, w: 220, h: 220, d: 22 };
const LISSAJOUS_RADIUS = 76;
const STEPS = 512;

const shape = createBox(BOX);
const bounds = shapeBounds(shape);

const PAD = 4;
const vx = bounds.minX - PAD;
const vy = bounds.minY - PAD;

// Golden-ratio framing — focal point at upper-RIGHT power point
const PHI_INV_SQ = 0.381_966_011_250_105_1;
const ANCHOR_X = CANVAS_W * (1 - PHI_INV_SQ); // ~61.8% from left
const ANCHOR_Y = CANVAS_H * PHI_INV_SQ; // ~38.2% from top

const focalIso = project(BOX.x + BOX.w / 2, BOX.y + BOX.h / 2, BOX.z + BOX.d);

function isoToCanvas([ix, iy]: Vec2): Vec2 {
  return [ANCHOR_X + (ix - focalIso[0]), ANCHOR_Y + (iy - focalIso[1])];
}

// Extreme projected corners for hairlines
const bottomZ = BOX.z;
const topZB = BOX.z + BOX.d;
const rightCorner = isoToCanvas(project(BOX.x + BOX.w, BOX.y, bottomZ));
const topCorner = isoToCanvas(project(BOX.x, BOX.y, topZB));
const bottomCorner = isoToCanvas(
  project(BOX.x + BOX.w, BOX.y + BOX.h, bottomZ)
);

// Box SVG position within the canvas
const BOX_LEFT = ANCHOR_X - (focalIso[0] - vx);
const BOX_TOP = ANCHOR_Y - (focalIso[1] - vy);

const topZ = BOX.z + BOX.d;
const cx = BOX.x + BOX.w / 2;
const cy = BOX.y + BOX.h / 2;

const lissajousProjected: Vec2[] = computeLissajousPoints(
  LOGO_CURVE.a,
  LOGO_CURVE.b,
  LOGO_CURVE.delta,
  STEPS
)
  .slice(0, STEPS)
  .map(([px, py]) =>
    project(cx + LISSAJOUS_RADIUS * px, cy + LISSAJOUS_RADIUS * py, topZ)
  );

const lissajousPath = `${lissajousProjected
  .map((v, i) => `${i === 0 ? "M" : "L"}${v[0].toFixed(2)},${v[1].toFixed(2)}`)
  .join(" ")} Z`;

const faces = shape.faces;

/** Horizontal hairline Y as % of canvas height — right hairline uses this Y. */
export const HAIRLINE_Y_PCT = (rightCorner[1] / CANVAS_H) * 100;

/** Vertical hairline X as % of canvas width — bottom hairline. */
export const HAIRLINE_BOTTOM_X_PCT = (bottomCorner[0] / CANVAS_W) * 100;

/** Vertical hairline X as % of canvas width — both top and bottom hairlines share this X. */
export const HAIRLINE_X_PCT = (topCorner[0] / CANVAS_W) * 100;

export function IsometricHero() {
  return (
    <div className="bg- aspect-video w-full overflow-hidden rounded-md">
      <svg
        className="h-full w-full"
        viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Hairlines from box corners to canvas edges */}
        <line
          stroke="var(--border)"
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
          x1={rightCorner[0]}
          x2={CANVAS_W}
          y1={rightCorner[1]}
          y2={rightCorner[1]}
        />
        <line
          stroke="var(--border)"
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
          x1={topCorner[0]}
          x2={topCorner[0]}
          y1={0}
          y2={topCorner[1]}
        />
        <line
          stroke="var(--border)"
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
          x1={bottomCorner[0]}
          x2={bottomCorner[0]}
          y1={bottomCorner[1]}
          y2={CANVAS_H}
        />

        {/* Isometric box faces + Lissajous curve */}
        <g transform={`translate(${BOX_LEFT - vx}, ${BOX_TOP - vy})`}>
          {faces.map((face, i) => (
            <path
              d={facePath(face)}
              fill="var(--background)"
              fillRule="evenodd"
              key={`${face.type}-${i}`}
              stroke="var(--border)"
              strokeWidth={1}
            />
          ))}
          <path
            d={lissajousPath}
            fill="none"
            stroke="var(--border)"
            strokeWidth={1}
          />
        </g>
      </svg>
    </div>
  );
}
