import type React from "react";
import { Easing, interpolate, useCurrentFrame } from "remotion";
import { BEAM_TIMING, MOTION_DURATION } from "./timing";

interface GridLinesProps {
  cellH: number;
  cellW: number;
  planeH: number;
  planeW: number;
  startFrame?: number;
}

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
      easing: Easing.out((t: number) => Easing.quad(t)),
    }
  );

  const lineOpacity = interpolate(
    frame,
    [startFrame, startFrame + MOTION_DURATION.GRID_OPACITY],
    [0, 0.6],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
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
      easing: Easing.inOut((t: number) => Easing.cubic(t)),
    }
  );

  const beamHeadY = BEAM_START_Y + (BEAM_END_Y - BEAM_START_Y) * beamProgress;
  const beamTailY = Math.max(BEAM_START_Y, beamHeadY - BEAM_LENGTH);

  // Fade in at start, fade out after arrival
  const beamFadeIn = interpolate(
    frame,
    [BEAM_TIMING.START, BEAM_TIMING.START + 8],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  const beamFadeOut = interpolate(
    frame,
    [BEAM_TIMING.ARRIVAL, BEAM_TIMING.ARRIVAL + 10],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
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
        easing: Easing.out((t: number) => Easing.cubic(t)),
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
      className="pointer-events-none absolute top-0 left-0"
      height={planeH}
      width={planeW}
    >
      {/* Beam gradient — follows the beam position each frame */}
      {beamOpacity > 0 && (
        <defs>
          <linearGradient
            gradientUnits="userSpaceOnUse"
            id="beam-grad-v"
            x1="0"
            x2="0"
            y1={beamTailY}
            y2={beamHeadY}
          >
            <stop offset="0%" stopColor="#ffffff" stopOpacity={0} />
            <stop offset="80%" stopColor="#ffffff" stopOpacity={0.4} />
            <stop offset="100%" stopColor="#ffffff" stopOpacity={1} />
          </linearGradient>
        </defs>
      )}

      {/* Vertical grid lines */}
      {[1, 2].map((n) => (
        <line
          key={`v${n}`}
          opacity={lineOpacity}
          strokeDasharray="8 12"
          strokeDashoffset={vOffsets[n - 1]}
          strokeWidth={2}
          style={{ stroke: "var(--border)" }}
          x1={n * cellW}
          x2={n * cellW}
          y1={0}
          y2={planeH * drawProgress}
        />
      ))}
      {/* Horizontal grid lines */}
      {[1, 2].map((n) => (
        <line
          key={`h${n}`}
          opacity={lineOpacity}
          strokeDasharray="8 12"
          strokeDashoffset={hOffsets[n - 1]}
          strokeWidth={2}
          style={{ stroke: "var(--border)" }}
          x1={0}
          x2={planeW * drawProgress}
          y1={n * cellH}
          y2={n * cellH}
        />
      ))}

      {/* ── Beam effects ── */}
      {beamOpacity > 0 &&
        beamXPositions.map((bx) => (
          <g key={`beam-${bx}`}>
            {/* Glow layer — wider, translucent */}
            <line
              opacity={beamOpacity * 0.12}
              stroke="#ffffff"
              strokeLinecap="round"
              strokeWidth={8}
              x1={bx}
              x2={bx}
              y1={beamTailY}
              y2={beamHeadY}
            />
            {/* Core beam — gradient tail */}
            <line
              opacity={beamOpacity}
              stroke="url(#beam-grad-v)"
              strokeLinecap="round"
              strokeWidth={2}
              x1={bx}
              x2={bx}
              y1={beamTailY}
              y2={beamHeadY}
            />
            {/* Head dot */}
            <circle
              cx={bx}
              cy={beamHeadY}
              fill="#ffffff"
              opacity={beamOpacity * 0.9}
              r={3}
            />
          </g>
        ))}

      {/* ── Intersection flash — rings + horizontal pulse ── */}
      {flashActive && (
        <>
          {beamXPositions.map((cx) => (
            <circle
              cx={cx}
              cy={cellH * 2}
              fill="none"
              key={`flash-${cx}`}
              opacity={flashOpacity}
              r={flashRadius}
              stroke="#ffffff"
              strokeWidth={1.5}
            />
          ))}
          {/* Horizontal pulse along y=1024 between the two column intersections */}
          <line
            opacity={lineFlashOpacity}
            stroke="#ffffff"
            strokeWidth={2}
            x1={cellW}
            x2={cellW * 2}
            y1={cellH * 2}
            y2={cellH * 2}
          />
        </>
      )}
    </svg>
  );
};
