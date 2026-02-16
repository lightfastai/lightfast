import type React from "react";
import { AbsoluteFill, delayRender, continueRender } from "remotion";
import { useEffect, useState } from "react";
import { StreamEvents } from "./sections/StreamEvents";
import { LogoAnimation } from "./sections/LogoAnimation";
import { IngestedData } from "./sections/IngestedData";
import { ConnectionLine } from "./shared/ConnectionLine";
import { COLORS } from "./shared/colors";
import { SECTION_TIMING } from "./shared/timing";
import { ensureFontsLoaded } from "./shared/fonts";

/**
 * Top-to-bottom isometric layout — centers collinear at slope 5.6.
 * Logo is exactly centered in the plane (x=240 = planeW/2).
 *
 *   Element          Top-left     Size      Center
 *   StreamEvents     (0, 0)       380×320   (190, 160)
 *                                           ↓ 30px gap
 *   Logo             (150, 350)   180×180   (240, 440)  ← plane center
 *                                           ↓ 30px gap
 *   IngestedData     (100, 560)   380×320   (290, 720)
 *
 *   DX=50  DY=280  Gap=30px  Plane: 480×880
 */
const PLANE_WIDTH = 480;
const PLANE_HEIGHT = 880;

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
            perspective(1200px)
            rotateX(55deg)
            rotateZ(-45deg)
          `,
          transformOrigin: "center center",
        }}
      >
        {/* Connection 1: StreamEvents bottom-center → Logo top-center */}
        <ConnectionLine
          x1={190}
          y1={320}
          x2={240}
          y2={350}
          startFrame={SECTION_TIMING.CONNECTION_1.start}
          drawDuration={20}
        />

        {/* Connection 2: Logo bottom-center → IngestedData top-center */}
        <ConnectionLine
          x1={240}
          y1={530}
          x2={290}
          y2={560}
          startFrame={SECTION_TIMING.CONNECTION_2.start}
          drawDuration={20}
        />

        <StreamEvents />
        <LogoAnimation />
        <IngestedData />
      </div>
    </AbsoluteFill>
  );
};
