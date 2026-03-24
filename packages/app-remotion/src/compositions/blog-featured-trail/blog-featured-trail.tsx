import { lissajousPoints } from "@repo/ui/lib/brand";
import { AbsoluteFill, continueRender, delayRender } from "@vendor/remotion";
import type React from "react";
import { useEffect, useMemo, useState } from "react";
import { ensureFontsLoaded } from "../landing-hero/shared/fonts";

// ── Constants ─────────────────────────────────────────────────────────────────

const CANVAS_W = 1200;
const CANVAS_H = 630;
const CX = CANVAS_W / 2;
const CY = CANVAS_H / 2;

// The logo curve radius on canvas
const RADIUS = 100;

// How far along the path the "head" sits — frozen at ~70% completion
const TRAIL_FILL = 0.70;

// Number of discrete segments used to build the fading trail
const SEGMENT_COUNT = 120;

// ── Component ─────────────────────────────────────────────────────────────────

/**
 * BlogFeaturedTrail
 *
 * A comet-trail rendering of the Lightfast logo curve.
 *
 * The path is reconstructed as SEGMENT_COUNT short polyline segments.
 * Each segment carries a linearly interpolated opacity: near-zero at the
 * furthest-back tail, ramping to 1.0 at the leading "head" (~70% through
 * the full curve).  The head also receives a small glowing dot to anchor
 * the eye at the brightest point.
 *
 * The remaining 30% of the closed curve is drawn as a ghost at ~0.06 opacity
 * so the full shape is implied without competing with the bright head.
 *
 * Canvas: 1200 × 630, physical 2400 × 1260 (scale:2).
 */
export const BlogFeaturedTrail: React.FC = () => {
  const [handle] = useState(() => delayRender("Loading fonts"));

  useEffect(() => {
    void ensureFontsLoaded()
      .then(() => continueRender(handle))
      .catch((err: unknown) => {
        console.error("Font loading failed:", err);
        continueRender(handle);
      });
  }, [handle]);

  const geometry = useMemo(() => {
    // Raw lissajous points, normalized [-1,1]
    const rawPts = lissajousPoints(); // 513 points for LOGO_CURVE

    // Map to canvas coordinates
    const pts: Array<[number, number]> = rawPts.map(([x, y]) => [
      CX + x * RADIUS,
      CY + y * RADIUS,
    ]);

    const total = pts.length; // 513

    // ── Active trail: first TRAIL_FILL of the path ────────────────────────

    // Which index marks the "head" of the trail?
    const headIdx = Math.floor(total * TRAIL_FILL);

    // Build SEGMENT_COUNT evenly-spaced sub-paths along [0..headIdx]
    // Each segment is a short polyline; opacity is linear 0→1 as i→SEGMENT_COUNT
    const segments: Array<{ d: string; opacity: number }> = [];

    for (let s = 0; s < SEGMENT_COUNT; s++) {
      // Map segment index to point indices within [0..headIdx]
      const startFrac = s / SEGMENT_COUNT;
      const endFrac = (s + 1) / SEGMENT_COUNT;
      const startIdx = Math.floor(startFrac * headIdx);
      const endIdx = Math.min(Math.floor(endFrac * headIdx), headIdx);

      // Slice points for this segment
      const segPts = pts.slice(startIdx, endIdx + 1);
      if (segPts.length < 2) continue;

      const d = segPts
        .map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`)
        .join("");

      // Ease-in opacity: dim tail → bright head
      // Use a slight power curve so the bright part feels concentrated
      const t = (s + 1) / SEGMENT_COUNT;
      const opacity = Math.pow(t, 1.8);

      segments.push({ d, opacity });
    }

    // ── Ghost tail: remaining TRAIL_FILL→1.0 portion ─────────────────────

    const ghostPts = pts.slice(headIdx);
    const ghostD =
      ghostPts.length > 1
        ? ghostPts
            .map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`)
            .join("")
        : "";

    // ── Head dot position ─────────────────────────────────────────────────

    const [hx, hy] = pts[headIdx] ?? [CX, CY];

    return { segments, ghostD, hx, hy };
  }, []);

  // Stroke width: thin — 1.5px at 1× canvas
  const sw = 1.5;

  return (
    <AbsoluteFill className="bg-background">
      <svg
        height={CANVAS_H}
        viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}
        width={CANVAS_W}
        style={{ display: "block" }}
      >
        {/* Ghost remainder of the path so the closed shape is sublty implied */}
        {geometry.ghostD && (
          <path
            d={geometry.ghostD}
            fill="none"
            opacity={0.06}
            stroke="var(--foreground)"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={sw}
          />
        )}

        {/* Fading trail segments from tail (dim) to head (bright) */}
        {geometry.segments.map(({ d, opacity }, i) => (
          <path
            // biome-ignore lint/suspicious/noArrayIndexKey: stable geometry array
            key={i}
            d={d}
            fill="none"
            opacity={opacity}
            stroke="var(--foreground)"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={sw}
          />
        ))}

        {/* Head glow: outer soft halo */}
        <circle
          cx={geometry.hx}
          cy={geometry.hy}
          fill="var(--foreground)"
          opacity={0.12}
          r={7}
        />
        {/* Head glow: mid ring */}
        <circle
          cx={geometry.hx}
          cy={geometry.hy}
          fill="var(--foreground)"
          opacity={0.35}
          r={3.5}
        />
        {/* Head: bright core dot */}
        <circle
          cx={geometry.hx}
          cy={geometry.hy}
          fill="var(--foreground)"
          opacity={1}
          r={1.8}
        />
      </svg>
    </AbsoluteFill>
  );
};
