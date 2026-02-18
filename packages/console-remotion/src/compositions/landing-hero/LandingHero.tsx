import type React from "react";
import { AbsoluteFill, delayRender, continueRender } from "remotion";
import { useEffect, useState } from "react";
import { StreamEvents } from "./sections/StreamEvents";
import { LogoAnimation } from "./sections/LogoAnimation";
import { IngestedData } from "./sections/IngestedData";
import { GridLines } from "./shared/GridLines";
import { COLORS } from "./shared/colors";
import { SECTION_TIMING } from "./shared/timing";
import { ensureFontsLoaded } from "./shared/fonts";

/**
 * 3×3 isometric grid layout.
 *
 *   Cell (col,row)     Contents
 *   (0,0)  (1,0)  (2,0)     ×  StreamEvents  ×
 *   (0,1)  (1,1)  (2,1)     ×  Logo           ×
 *   (0,2)  (1,2)  (2,2)     Connected  Indexed  Output
 *
 *   Cell: 512 × 512   Plane: 1536 × 1536
 */
const CELL_W = 512;
const CELL_H = 512;
const PLANE_WIDTH = CELL_W * 3;
const PLANE_HEIGHT = CELL_H * 3;
const PLANE_SCALE = 1;
const ISO_TILT_DEGREES = 54.7356;
const ISO_ROTATE_Z_DEGREES = -45;

export const LandingHero: React.FC = () => {
  const [handle] = useState(() => delayRender("Loading fonts"));

  useEffect(() => {
    ensureFontsLoaded().then(() => continueRender(handle));
  }, [handle]);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: COLORS.background,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          width: PLANE_WIDTH,
          height: PLANE_HEIGHT,
          position: "relative",
          transform: `
            rotateX(${ISO_TILT_DEGREES}deg)
            rotateZ(${ISO_ROTATE_Z_DEGREES}deg)
            scale(${PLANE_SCALE})
          `,
          transformOrigin: "left center",
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
        <LogoAnimation />
        <IngestedData />
      </div>
    </AbsoluteFill>
  );
};
