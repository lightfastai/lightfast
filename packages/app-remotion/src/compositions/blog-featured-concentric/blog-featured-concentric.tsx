import { LOGO_CURVE, lissajousPath } from "@repo/ui/lib/brand";
import { AbsoluteFill, continueRender, delayRender } from "@vendor/remotion";
import type React from "react";
import { useEffect, useMemo, useState } from "react";
import { ensureFontsLoaded } from "../landing-hero/shared/fonts";

const CANVAS_W = 1200;
const CANVAS_H = 630;
const CX = CANVAS_W / 2;
const CY = CANVAS_H / 2;

// 7 concentric rings: innermost is smallest, outermost is largest.
// Sizing: the outermost ring should nearly fill the shorter canvas dimension.
const RING_COUNT = 7;
const SIZE_MIN = 100;
const SIZE_MAX = 560;

// Opacity: innermost ring is most opaque, outermost ring fades to ghost
const OPACITY_INNER = 0.82;
const OPACITY_OUTER = 0.08;

// Padding fraction inside each ring's square canvas — tighter than default
const PADDING = 0.04;

// Stroke weight scales slightly with ring size for visual coherence
const BASE_STROKE_W = 1.2;

export const BlogFeaturedConcentric: React.FC = () => {
  const [handle] = useState(() => delayRender("Loading fonts"));

  useEffect(() => {
    void ensureFontsLoaded()
      .then(() => continueRender(handle))
      .catch((err: unknown) => {
        console.error("Font loading failed:", err);
        continueRender(handle);
      });
  }, [handle]);

  const rings = useMemo(() => {
    return Array.from({ length: RING_COUNT }, (_, i) => {
      // Linear interpolation from inner to outer
      const t = i / (RING_COUNT - 1);
      const size = SIZE_MIN + t * (SIZE_MAX - SIZE_MIN);

      // Opacity decreases as rings grow outward
      const opacity = OPACITY_INNER + t * (OPACITY_OUTER - OPACITY_INNER);

      // Stroke weight grows very slightly with size to preserve visual weight
      const strokeWidth = BASE_STROKE_W + t * 0.6;

      // lissajousPath centers at (size/2, size/2) — translate to canvas center
      const tx = CX - size / 2;
      const ty = CY - size / 2;

      const path = lissajousPath(
        size,
        PADDING,
        LOGO_CURVE.a,
        LOGO_CURVE.b,
        LOGO_CURVE.delta
      );

      return { path, tx, ty, opacity, strokeWidth, size };
    });
  }, []);

  return (
    <AbsoluteFill className="bg-background">
      <svg
        height={CANVAS_H}
        viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}
        width={CANVAS_W}
      >
        {/* Render outer rings first so inner rings sit on top */}
        {[...rings].reverse().map((ring, idx) => (
          <g
            key={`ring-${RING_COUNT - 1 - idx}`}
            transform={`translate(${ring.tx.toFixed(2)}, ${ring.ty.toFixed(2)})`}
          >
            <path
              d={ring.path}
              fill="none"
              opacity={ring.opacity}
              stroke="var(--foreground)"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={ring.strokeWidth}
            />
          </g>
        ))}

        {/* Subtle center registration mark — a pair of perpendicular hairlines */}
        <line
          opacity={0.12}
          stroke="var(--foreground)"
          strokeWidth={0.6}
          x1={CX - 12}
          x2={CX + 12}
          y1={CY}
          y2={CY}
        />
        <line
          opacity={0.12}
          stroke="var(--foreground)"
          strokeWidth={0.6}
          x1={CX}
          x2={CX}
          y1={CY - 12}
          y2={CY + 12}
        />
      </svg>
    </AbsoluteFill>
  );
};
