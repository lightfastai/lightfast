import {
  lissajousPoints as computeLissajousPoints,
  LOGO_CURVE,
} from "@repo/ui/lib/brand";
import { AbsoluteFill, continueRender, delayRender } from "@vendor/remotion";
import type React from "react";
import { useEffect, useMemo, useState } from "react";
import { ensureFontsLoaded } from "../landing-hero/shared/fonts";
import type { Box3D, Vec2 } from "../landing-hero/shared/iso";
import {
  createBox,
  facePath,
  project,
  shapeBounds,
} from "../landing-hero/shared/iso";

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
const vw = bounds.maxX - bounds.minX + PAD * 2;
const vh = bounds.maxY - bounds.minY + PAD * 2;

// Golden-ratio framing. The focal point of the subject — the lissajous center
// on the top face — is anchored at the upper-left golden power point:
//   x = W · (1 − 1/φ) ≈ W · 0.382
//   y = H · (1 − 1/φ) ≈ H · 0.382
const PHI_INV_SQ = 0.381_966_011_250_105_1;
const ANCHOR_X = CANVAS_W * PHI_INV_SQ;
const ANCHOR_Y = CANVAS_H * PHI_INV_SQ;

// Focal point in iso space: center of the top face (where the lissajous sits).
const focalIso = project(BOX.x + BOX.w / 2, BOX.y + BOX.h / 2, BOX.z + BOX.d);

function isoToCanvas([ix, iy]: Vec2): Vec2 {
  return [ANCHOR_X + (ix - focalIso[0]), ANCHOR_Y + (iy - focalIso[1])];
}

// The four extreme corners of the iso projection:
//  • left/right: bottom-square front-left / back-right corners (same y)
//  • bottom-most: bottom-square front corner
//  • top-most:    top-square back corner
const bottomZ = BOX.z;
const topZB = BOX.z + BOX.d;
const leftCorner = isoToCanvas(project(BOX.x, BOX.y + BOX.h, bottomZ));
const rightCorner = isoToCanvas(project(BOX.x + BOX.w, BOX.y, bottomZ));
const bottomCorner = isoToCanvas(project(BOX.x + BOX.w, BOX.y + BOX.h, bottomZ));
const topCorner = isoToCanvas(project(BOX.x, BOX.y, topZB));

// Pixel offset for the box SVG so its focal point lands on the anchor.
// SVG top-left in canvas = anchor − (focalIso − viewBox origin).
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

const FACE_FILL: Record<string, string> = {
  top: "var(--card)",
  front: "var(--card)",
  right: "var(--card)",
};

export const BlogWhyWeBuiltFeatured: React.FC = () => {
  const [handle] = useState(() => delayRender("Loading fonts"));

  useEffect(() => {
    void ensureFontsLoaded()
      .then(() => continueRender(handle))
      .catch((err: unknown) => {
        console.error("Font loading failed:", err);
        continueRender(handle);
      });
  }, [handle]);

  const faces = useMemo(() => shape.faces, []);

  return (
    <AbsoluteFill className="bg-card">
      <svg
        height={CANVAS_H}
        style={{ position: "absolute", inset: 0 }}
        viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}
        width={CANVAS_W}
      >
        {/* left edge → bottom-square left corner */}
        <line
          stroke="var(--border)"
          strokeWidth={1}
          x1={0}
          x2={leftCorner[0]}
          y1={leftCorner[1]}
          y2={leftCorner[1]}
        />
        {/* bottom-square right corner → right edge */}
        <line
          stroke="var(--border)"
          strokeWidth={1}
          x1={rightCorner[0]}
          x2={CANVAS_W}
          y1={rightCorner[1]}
          y2={rightCorner[1]}
        />
        {/* top-most corner → top edge */}
        <line
          stroke="var(--border)"
          strokeWidth={1}
          x1={topCorner[0]}
          x2={topCorner[0]}
          y1={0}
          y2={topCorner[1]}
        />
        {/* bottom-most corner → bottom edge */}
        <line
          stroke="var(--border)"
          strokeWidth={1}
          x1={bottomCorner[0]}
          x2={bottomCorner[0]}
          y1={bottomCorner[1]}
          y2={CANVAS_H}
        />
      </svg>
      <div style={{ position: "absolute", left: BOX_LEFT, top: BOX_TOP }}>
        <svg height={vh} viewBox={`${vx} ${vy} ${vw} ${vh}`} width={vw}>
          {faces.map((face, i) => (
            <path
              d={facePath(face)}
              fillRule="evenodd"
              key={`${face.type}-${i}`}
              strokeWidth={1}
              style={{ fill: FACE_FILL[face.type], stroke: "var(--border)" }}
            />
          ))}
          <path
            d={lissajousPath}
            fill="none"
            strokeWidth={1}
            style={{ stroke: "var(--border)" }}
          />
        </svg>
      </div>
    </AbsoluteFill>
  );
};
