import type React from "react";
import { useCurrentFrame, interpolate, Easing } from "remotion";
import { COLORS } from "./colors";
import { MOTION_DURATION } from "./timing";

type GridLinesProps = {
  cellW: number;
  cellH: number;
  planeW: number;
  planeH: number;
  startFrame?: number;
};

const BORDER_BORDER = COLORS.border;

export const GridLines: React.FC<GridLinesProps> = ({
  cellW,
  cellH,
  planeW,
  planeH,
  startFrame = 0,
}) => {
  const frame = useCurrentFrame();

  const drawProgress = interpolate(
    frame,
    [startFrame, startFrame + MOTION_DURATION.GRID_DRAW],
    [0, 1],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.out(Easing.quad),
    },
  );

  const lineOpacity = interpolate(
    frame,
    [startFrame, startFrame + MOTION_DURATION.GRID_OPACITY],
    [0, 0.6],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  const DASH_SPEED = 0.5;
  // Vertical line 1 flows down, line 2 flows up
  const vOffsets = [-frame * DASH_SPEED, frame * DASH_SPEED];
  // Horizontal line 1 flows right, line 2 flows left
  const hOffsets = [-frame * DASH_SPEED, frame * DASH_SPEED];

  return (
    <svg
      width={planeW}
      height={planeH}
      style={{ position: "absolute", left: 0, top: 0, pointerEvents: "none" }}
    >
      {/* Vertical grid lines */}
      {[1, 2].map((i) => (
        <line
          key={`v${i}`}
          x1={i * cellW}
          y1={0}
          x2={i * cellW}
          y2={planeH * drawProgress}
          stroke={BORDER_BORDER}
          strokeWidth={2}
          strokeDasharray="8 12"
          strokeDashoffset={vOffsets[i - 1]}
          opacity={lineOpacity}
        />
      ))}
      {/* Horizontal grid lines */}
      {[1, 2].map((i) => (
        <line
          key={`h${i}`}
          x1={0}
          y1={i * cellH}
          x2={planeW * drawProgress}
          y2={i * cellH}
          stroke={BORDER_BORDER}
          strokeWidth={2}
          strokeDasharray="8 12"
          strokeDashoffset={hOffsets[i - 1]}
          opacity={lineOpacity}
        />
      ))}
    </svg>
  );
};
