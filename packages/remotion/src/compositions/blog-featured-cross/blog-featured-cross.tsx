import { lissajousPath } from "@repo/ui/lib/brand";
import { AbsoluteFill, continueRender, delayRender } from "@vendor/remotion";
import type React from "react";
import { useEffect, useMemo, useState } from "react";
import { ensureFontsLoaded } from "../landing-hero/shared/fonts";

// Architectural precision — a targeting reticle, a survey marker, a register mark.
// Two full-bleed hairlines divide the canvas into quadrants at their intersection.
// The logo sits exactly at the crossing point, the organic curve in dialogue
// with the absolute geometry of orthogonal axes. At 40% opacity the lines
// recede; the curve is unmistakably the dominant element.

const LOGO_SIZE = 150;
const PADDING = 0.28;
const CANVAS_W = 1200;
const CANVAS_H = 630;
const CX = CANVAS_W / 2;
const CY = CANVAS_H / 2;

// Hairline opacity — present but subordinate to the curve
const LINE_OPACITY = 0.4;

export const BlogFeaturedCross: React.FC = () => {
  const [handle] = useState(() => delayRender("Loading fonts"));

  useEffect(() => {
    void ensureFontsLoaded()
      .then(() => continueRender(handle))
      .catch((err: unknown) => {
        console.error("Font loading failed:", err);
        continueRender(handle);
      });
  }, [handle]);

  // Path centered at (LOGO_SIZE/2, LOGO_SIZE/2); translate to canvas center
  const path = useMemo(() => lissajousPath(LOGO_SIZE, PADDING), []);
  const tx = CX - LOGO_SIZE / 2;
  const ty = CY - LOGO_SIZE / 2;
  const sw = Math.max(1, Math.round(LOGO_SIZE * 0.016));

  return (
    <AbsoluteFill className="bg-background">
      <svg
        height={CANVAS_H}
        viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}
        width={CANVAS_W}
      >
        {/* Horizontal axis — full canvas width through center */}
        <line
          opacity={LINE_OPACITY}
          stroke="var(--border)"
          strokeWidth={1}
          x1={0}
          x2={CANVAS_W}
          y1={CY}
          y2={CY}
        />

        {/* Vertical axis — full canvas height through center */}
        <line
          opacity={LINE_OPACITY}
          stroke="var(--border)"
          strokeWidth={1}
          x1={CX}
          x2={CX}
          y1={0}
          y2={CANVAS_H}
        />

        {/* Logo curve — centered at axis intersection */}
        <g transform={`translate(${tx}, ${ty})`}>
          <path
            d={path}
            fill="none"
            stroke="var(--border)"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={sw}
          />
        </g>
      </svg>
    </AbsoluteFill>
  );
};
