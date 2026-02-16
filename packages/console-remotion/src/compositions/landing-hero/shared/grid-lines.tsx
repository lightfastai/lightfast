import type React from "react";
import { useCurrentFrame, interpolate, Easing } from "remotion";
import { MOTION_DURATION, BEAM_TIMING } from "./timing";

type GridLinesProps = {
  cellW: number;
  cellH: number;
  planeW: number;
  planeH: number;
  startFrame?: number;
};

export const GridLines: React.FC<GridLinesProps> = ({
  cellW,
  cellH,
  planeW,
  planeH,
  startFrame = 0,
}) => {
  const frame = useCurrentFrame();

  // ── Grid draw animation ──
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
  const vOffsets = [-frame * DASH_SPEED, frame * DASH_SPEED];
  const hOffsets = [-frame * DASH_SPEED, frame * DASH_SPEED];

  // ── Beam animation ──
  const BEAM_LENGTH = 100;
  const BEAM_START_Y = 0;
  const BEAM_END_Y = cellH * 2; // y = 1024

  const beamProgress = interpolate(
    frame,
    [BEAM_TIMING.START, BEAM_TIMING.START + BEAM_TIMING.TRAVEL_FRAMES],
    [0, 1],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.inOut(Easing.cubic),
    },
  );

  const beamHeadY =
    BEAM_START_Y + (BEAM_END_Y - BEAM_START_Y) * beamProgress;
  const beamTailY = Math.max(BEAM_START_Y, beamHeadY - BEAM_LENGTH);

  // Fade in at start, fade out after arrival
  const beamFadeIn = interpolate(
    frame,
    [BEAM_TIMING.START, BEAM_TIMING.START + 8],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const beamFadeOut = interpolate(
    frame,
    [BEAM_TIMING.ARRIVAL, BEAM_TIMING.ARRIVAL + 10],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const beamOpacity = Math.min(beamFadeIn, beamFadeOut);

  // ── Intersection flash ──
  const FLASH_DURATION = 20;
  const flashFrame = frame - BEAM_TIMING.ARRIVAL;
  const flashActive = flashFrame >= 0 && flashFrame < FLASH_DURATION;

  const flashRadius = flashActive
    ? interpolate(flashFrame, [0, FLASH_DURATION], [3, 28], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
        easing: Easing.out(Easing.cubic),
      })
    : 0;
  const flashOpacity = flashActive
    ? interpolate(flashFrame, [0, FLASH_DURATION], [0.9, 0], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      })
    : 0;

  // Horizontal pulse connecting the two intersection points
  const lineFlashOpacity = flashActive
    ? interpolate(flashFrame, [0, 6, FLASH_DURATION], [0, 0.5, 0], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      })
    : 0;

  const beamXPositions = [cellW, cellW * 2];

  return (
    <svg
      width={planeW}
      height={planeH}
      className="pointer-events-none absolute left-0 top-0"
    >
      {/* Beam gradient — follows the beam position each frame */}
      {beamOpacity > 0 && (
        <defs>
          <linearGradient
            id="beam-grad-v"
            gradientUnits="userSpaceOnUse"
            x1="0"
            y1={beamTailY}
            x2="0"
            y2={beamHeadY}
          >
            <stop offset="0%" stopColor="#ffffff" stopOpacity={0} />
            <stop offset="80%" stopColor="#ffffff" stopOpacity={0.4} />
            <stop offset="100%" stopColor="#ffffff" stopOpacity={1} />
          </linearGradient>
        </defs>
      )}

      {/* Vertical grid lines */}
      {[1, 2].map((i) => (
        <line
          key={`v${i}`}
          x1={i * cellW}
          y1={0}
          x2={i * cellW}
          y2={planeH * drawProgress}
          style={{ stroke: "var(--border)" }}
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
          style={{ stroke: "var(--border)" }}
          strokeWidth={2}
          strokeDasharray="8 12"
          strokeDashoffset={hOffsets[i - 1]}
          opacity={lineOpacity}
        />
      ))}

      {/* ── Beam effects ── */}
      {beamOpacity > 0 &&
        beamXPositions.map((bx, i) => (
          <g key={`beam-${i}`}>
            {/* Glow layer — wider, translucent */}
            <line
              x1={bx}
              y1={beamTailY}
              x2={bx}
              y2={beamHeadY}
              stroke="#ffffff"
              strokeWidth={8}
              opacity={beamOpacity * 0.12}
              strokeLinecap="round"
            />
            {/* Core beam — gradient tail */}
            <line
              x1={bx}
              y1={beamTailY}
              x2={bx}
              y2={beamHeadY}
              stroke="url(#beam-grad-v)"
              strokeWidth={2}
              opacity={beamOpacity}
              strokeLinecap="round"
            />
            {/* Head dot */}
            <circle
              cx={bx}
              cy={beamHeadY}
              r={3}
              fill="#ffffff"
              opacity={beamOpacity * 0.9}
            />
          </g>
        ))}

      {/* ── Intersection flash — rings + horizontal pulse ── */}
      {flashActive && (
        <>
          {beamXPositions.map((cx, i) => (
            <circle
              key={`flash-${i}`}
              cx={cx}
              cy={cellH * 2}
              r={flashRadius}
              fill="none"
              stroke="#ffffff"
              strokeWidth={1.5}
              opacity={flashOpacity}
            />
          ))}
          {/* Horizontal pulse along y=1024 between the two column intersections */}
          <line
            x1={cellW}
            y1={cellH * 2}
            x2={cellW * 2}
            y2={cellH * 2}
            stroke="#ffffff"
            strokeWidth={2}
            opacity={lineFlashOpacity}
          />
        </>
      )}
    </svg>
  );
};
