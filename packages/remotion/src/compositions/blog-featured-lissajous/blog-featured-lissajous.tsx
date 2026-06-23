import { lissajousPath } from "@repo/ui/lib/brand";
import { AbsoluteFill, continueRender, delayRender } from "@vendor/remotion";
import type React from "react";
import { useEffect, useMemo, useState } from "react";
import { ensureFontsLoaded } from "../landing-hero/shared/fonts";

const LOGO_SIZE = 120;
const PADDING = 0.28;
const CANVAS_W = 1200;
const CANVAS_H = 630;

export const BlogFeaturedLissajous: React.FC = () => {
  const [handle] = useState(() => delayRender("Loading fonts"));

  useEffect(() => {
    void ensureFontsLoaded()
      .then(() => continueRender(handle))
      .catch((err: unknown) => {
        console.error("Font loading failed:", err);
        continueRender(handle);
      });
  }, [handle]);

  // Path is centered at (LOGO_SIZE/2, LOGO_SIZE/2); translate to canvas center
  const path = useMemo(() => lissajousPath(LOGO_SIZE, PADDING), []);
  const tx = CANVAS_W / 2 - LOGO_SIZE / 2;
  const ty = CANVAS_H / 2 - LOGO_SIZE / 2;
  const sw = Math.max(1, Math.round(LOGO_SIZE * 0.016));

  return (
    <AbsoluteFill className="bg-background">
      <svg
        height={CANVAS_H}
        viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}
        width={CANVAS_W}
      >
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
