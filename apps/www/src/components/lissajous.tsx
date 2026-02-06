"use client";

import { useMemo } from "react";

interface LissajousProps {
  /** Frequency ratio for x-axis (default: 3) */
  a?: number;
  /** Frequency ratio for y-axis (default: 2) */
  b?: number;
  /** Phase shift in radians (default: π/2) */
  delta?: number;
  /** Number of points to generate (default: 500) */
  points?: number;
  /** Stroke color (default: currentColor) */
  stroke?: string;
  /** Stroke width (default: 1) */
  strokeWidth?: number;
  /** Additional className for the SVG */
  className?: string;
  /** Padding inside the viewBox (default: 10) */
  padding?: number;
}

/**
 * Lissajous curve component
 *
 * Generates parametric curves defined by:
 * x = sin(a * t + δ)
 * y = sin(b * t)
 *
 * Common ratios and their shapes:
 * - a=1, b=1, δ=π/2 → Circle
 * - a=1, b=2, δ=π/2 → Figure-8
 * - a=3, b=2, δ=π/2 → Pretzel
 * - a=3, b=4, δ=π/2 → Complex knot
 * - a=5, b=4, δ=π/2 → Star-like
 */
export function Lissajous({
  a = 3,
  b = 2,
  delta = Math.PI / 2,
  points = 500,
  stroke = "currentColor",
  strokeWidth = 1,
  className = "",
  padding = 10,
}: LissajousProps) {
  const pathData = useMemo(() => {
    const pts: { x: number; y: number }[] = [];

    // Generate points along the curve
    for (let i = 0; i <= points; i++) {
      const t = (i / points) * 2 * Math.PI;
      const x = Math.sin(a * t + delta);
      const y = Math.sin(b * t);
      pts.push({ x, y });
    }

    // Scale to viewBox (100x100 with padding)
    const size = 100 - padding * 2;
    const scaledPts = pts.map((p) => ({
      x: padding + ((p.x + 1) / 2) * size,
      y: padding + ((p.y + 1) / 2) * size,
    }));

    // Build SVG path
    const d = scaledPts
      .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
      .join(" ");

    return d;
  }, [a, b, delta, points, padding]);

  return (
    <svg
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <path
        d={pathData}
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Preset configurations for common Lissajous patterns */
export const LISSAJOUS_PRESETS = {
  circle: { a: 1, b: 1, delta: Math.PI / 2 },
  figure8: { a: 1, b: 2, delta: Math.PI / 2 },
  pretzel: { a: 3, b: 2, delta: Math.PI / 2 },
  bow: { a: 2, b: 3, delta: Math.PI / 2 },
  knot: { a: 3, b: 4, delta: Math.PI / 2 },
  star: { a: 5, b: 4, delta: Math.PI / 2 },
  wave: { a: 1, b: 3, delta: Math.PI / 4 },
  infinity: { a: 2, b: 1, delta: Math.PI / 2 },
  clover: { a: 3, b: 1, delta: Math.PI / 2 },
} as const;

export type LissajousPreset = keyof typeof LISSAJOUS_PRESETS;
