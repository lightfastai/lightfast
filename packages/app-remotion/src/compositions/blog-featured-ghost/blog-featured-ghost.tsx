import { lissajousPath } from "@repo/ui/lib/brand";
import { AbsoluteFill, continueRender, delayRender } from "@vendor/remotion";
import type React from "react";
import { useEffect, useMemo, useState } from "react";
import { ensureFontsLoaded } from "../landing-hero/shared/fonts";

// ── Constants ─────────────────────────────────────────────────────────────────

const CANVAS_W = 1200;
const CANVAS_H = 630;
const PADDING = 0.28;

// Four concentric copies — smallest/faintest behind, largest/brightest front.
// Each layer: [size in px, opacity, strokeWidth in px]
const LAYERS: Array<[number, number, number]> = [
  [80,  0.10, 1.0],
  [120, 0.20, 1.2],
  [160, 0.42, 1.4],
  [200, 0.90, 1.6],
];

// ── Component ─────────────────────────────────────────────────────────────────

/**
 * BlogFeaturedGhost
 *
 * Four concentrically scaled copies of the Lightfast logo curve, rendered
 * at increasing size and opacity from back to front.
 *
 * The smallest layer (80 px, opacity 0.10) sits deepest, acting as a faint
 * echo.  Each successive layer grows and brightens, creating an effect like
 * a long-exposure photograph that collapses several moments into one frame —
 * or an object seen through layered panes of glass.
 *
 * All layers share the same center (canvas midpoint) and use very thin
 * strokes (1.0–1.6 px) to keep the impression delicate.
 *
 * Canvas: 1200 × 630, physical 2400 × 1260 (scale:2).
 */
export const BlogFeaturedGhost: React.FC = () => {
  const [handle] = useState(() => delayRender("Loading fonts"));

  useEffect(() => {
    void ensureFontsLoaded()
      .then(() => continueRender(handle))
      .catch((err: unknown) => {
        console.error("Font loading failed:", err);
        continueRender(handle);
      });
  }, [handle]);

  // Pre-compute one SVG path per layer; each path is self-centered at (size/2, size/2)
  const layers = useMemo(
    () =>
      LAYERS.map(([size, opacity, sw]) => {
        const path = lissajousPath(size, PADDING);
        // Translate so the layer center lands at canvas center
        const tx = CANVAS_W / 2 - size / 2;
        const ty = CANVAS_H / 2 - size / 2;
        return { path, tx, ty, opacity, sw };
      }),
    [],
  );

  return (
    <AbsoluteFill className="bg-background">
      <svg
        height={CANVAS_H}
        viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}
        width={CANVAS_W}
        style={{ display: "block" }}
      >
        {layers.map(({ path, tx, ty, opacity, sw }, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: stable geometry array
          <g key={i} opacity={opacity} transform={`translate(${tx}, ${ty})`}>
            <path
              d={path}
              fill="none"
              stroke="var(--foreground)"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={sw}
            />
          </g>
        ))}
      </svg>
    </AbsoluteFill>
  );
};
