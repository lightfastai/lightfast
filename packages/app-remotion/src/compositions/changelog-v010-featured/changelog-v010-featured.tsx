import { lissajousPath } from "@repo/ui/lib/brand";
import { AbsoluteFill, continueRender, delayRender } from "@vendor/remotion";
import type React from "react";
import { useEffect, useMemo, useState } from "react";
import { ensureFontsLoaded } from "../landing-hero/shared/fonts";

// ── Constants ─────────────────────────────────────────────────────────────────

const CANVAS_W = 1200;
const CANVAS_H = 675;
const PADDING = 0.28;

// Two subjects, symmetrically flanking the canvas center
const DUO_SIZE = 140;
const DUO_SW = 1.4;
const DUO_OPACITY = 0.88;

// Shared vertical center
const CY = CANVAS_H / 2;

// Horizontal positions — equidistant from canvas center
const LEFT_CX = 400;
const RIGHT_CX = 800;

// Hairline connecting/framing both curves
const HAIRLINE_OPACITY = 0.15;
const HAIRLINE_SW = 1;

// ── Curve parameters ──────────────────────────────────────────────────────────
const LEFT_CURVE = { a: 2, b: 1, delta: Math.PI / 2 } as const;
const RIGHT_CURVE = { a: 3, b: 2, delta: Math.PI / 2 } as const;

// ── Component ─────────────────────────────────────────────────────────────────

export const ChangelogV010Featured: React.FC = () => {
  const [handle] = useState(() => delayRender("Loading fonts"));

  useEffect(() => {
    void ensureFontsLoaded()
      .then(() => continueRender(handle))
      .catch((err: unknown) => {
        console.error("Font loading failed:", err);
        continueRender(handle);
      });
  }, [handle]);

  const { leftPath, rightPath } = useMemo(() => {
    return {
      leftPath: lissajousPath(
        DUO_SIZE,
        PADDING,
        LEFT_CURVE.a,
        LEFT_CURVE.b,
        LEFT_CURVE.delta
      ),
      rightPath: lissajousPath(
        DUO_SIZE,
        PADDING,
        RIGHT_CURVE.a,
        RIGHT_CURVE.b,
        RIGHT_CURVE.delta
      ),
    };
  }, []);

  return (
    <AbsoluteFill className="bg-card">
      <svg
        height={CANVAS_H}
        style={{ display: "block" }}
        viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}
        width={CANVAS_W}
      >
        {/* Hairline at y = CY — shared horizon for both subjects */}
        <line
          opacity={HAIRLINE_OPACITY}
          stroke="var(--border)"
          strokeWidth={HAIRLINE_SW}
          x1={0}
          x2={CANVAS_W}
          y1={CY}
          y2={CY}
        />

        {/* Left subject — infinity curve (a=2, b=1) */}
        <g
          opacity={DUO_OPACITY}
          transform={`translate(${LEFT_CX - DUO_SIZE / 2}, ${CY - DUO_SIZE / 2})`}
        >
          <path
            d={leftPath}
            fill="none"
            stroke="var(--border)"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={DUO_SW}
          />
        </g>

        {/* Right subject — logo / pretzel curve (a=3, b=2) */}
        <g
          opacity={DUO_OPACITY}
          transform={`translate(${RIGHT_CX - DUO_SIZE / 2}, ${CY - DUO_SIZE / 2})`}
        >
          <path
            d={rightPath}
            fill="none"
            stroke="var(--border)"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={DUO_SW}
          />
        </g>
      </svg>
    </AbsoluteFill>
  );
};
