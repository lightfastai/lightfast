import { lissajousPath } from "@repo/ui/lib/brand";
import { AbsoluteFill, continueRender, delayRender } from "@vendor/remotion";
import type React from "react";
import { useEffect, useMemo, useState } from "react";
import { ensureFontsLoaded } from "../landing-hero/shared/fonts";

// Oscilloscope / scientific diagram aesthetic.
// A single 1px horizontal rule bisects the canvas at exactly 50%.
// The logo curve (140px) sits centered on that line — the rule passes through
// its geometric center, as if the curve were a signal plotted on a baseline.

const LOGO_SIZE = 140;
const PADDING = 0.28;
const CANVAS_W = 1200;
const CANVAS_H = 630;

// Rule extends 80% of canvas width, centered
const RULE_W = CANVAS_W * 0.8;
const RULE_X1 = (CANVAS_W - RULE_W) / 2;
const RULE_X2 = RULE_X1 + RULE_W;
const RULE_Y = CANVAS_H / 2;

export const BlogFeaturedRule: React.FC = () => {
  const [handle] = useState(() => delayRender("Loading fonts"));

  useEffect(() => {
    void ensureFontsLoaded()
      .then(() => continueRender(handle))
      .catch((err: unknown) => {
        console.error("Font loading failed:", err);
        continueRender(handle);
      });
  }, [handle]);

  const path = useMemo(() => lissajousPath(LOGO_SIZE, PADDING), []);

  // Translate so the center of the LOGO_SIZE square sits exactly on RULE_Y
  const cx = CANVAS_W / 2 - LOGO_SIZE / 2;
  const cy = RULE_Y - LOGO_SIZE / 2;

  return (
    <AbsoluteFill className="bg-background">
      <svg
        height={CANVAS_H}
        viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}
        width={CANVAS_W}
      >
        {/* Horizontal rule — rendered first so curve sits on top */}
        <line
          stroke="var(--border)"
          strokeWidth={1}
          x1={RULE_X1}
          x2={RULE_X2}
          y1={RULE_Y}
          y2={RULE_Y}
        />

        {/* Logo curve centered on the rule */}
        <g transform={`translate(${cx}, ${cy})`}>
          <path
            d={path}
            fill="none"
            stroke="var(--border)"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
          />
        </g>
      </svg>
    </AbsoluteFill>
  );
};
