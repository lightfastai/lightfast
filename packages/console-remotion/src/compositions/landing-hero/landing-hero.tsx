import type React from "react";
import { AbsoluteFill, delayRender, continueRender } from "remotion";
import { useEffect, useState } from "react";
import { StreamEvents } from "./sections/stream-events";
import { LogoAnimation } from "./sections/logo-animation";
import { IngestedData } from "./sections/ingested-data";
import { GridLines } from "./shared/grid-lines";
import { SECTION_TIMING } from "./shared/timing";
import { ensureFontsLoaded } from "./shared/fonts";

/**
 * 3×3 isometric grid layout.
 *
 *   Cell (col,row)     Contents
 *   (0,0)  (1,0)  (2,0)     ×  StreamEvents  ×
 *   (0,1)  (1,1)  (2,1)     ×  Logo           ×
 *   (0,2)  (1,2)  (2,2)     [--- Search (2-wide, centered) ---]
 *
 *   Cell: 512 × 512   Plane: 1536 × 1536
 */
const CELL_W = 512;
const CELL_H = 512;
const PLANE_WIDTH = CELL_W * 3;
const PLANE_HEIGHT = CELL_H * 3;
const PLANE_SCALE = 1.1;
const ISO_TILT_DEGREES = 54.7356;
const ISO_ROTATE_Z_DEGREES = -45;

export const LandingHero: React.FC = () => {
  const [handle] = useState(() => delayRender("Loading fonts"));

  useEffect(() => {
    void ensureFontsLoaded().then(() => continueRender(handle));
  }, [handle]);

  return (
    <AbsoluteFill className="bg-background">
      {/* Centering wrapper — keeps translate separate from 3D context */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
      <div
        className="origin-center"
        style={{
          width: PLANE_WIDTH,
          height: PLANE_HEIGHT,
          transform: `
            rotateX(${ISO_TILT_DEGREES}deg)
            rotateZ(${ISO_ROTATE_Z_DEGREES}deg)
            scale(${PLANE_SCALE})
          `,
          transformStyle: "preserve-3d",
        }}
      >
        <GridLines
          cellW={CELL_W}
          cellH={CELL_H}
          planeW={PLANE_WIDTH}
          planeH={PLANE_HEIGHT}
          startFrame={SECTION_TIMING.GRID.start}
        />

        <StreamEvents />
        <IngestedData />
      </div>
      </div>

      {/* LogoAnimation uses its own math-based iso projection — render outside CSS 3D plane */}
      <LogoAnimation />
    </AbsoluteFill>
  );
};
