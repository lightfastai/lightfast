import type React from "react";
import { useCurrentFrame, interpolate, Easing } from "remotion";
import { COLORS } from "./colors";

type ConnectionLineProps = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  startFrame: number;
  drawDuration?: number;
};

export const ConnectionLine: React.FC<ConnectionLineProps> = ({
  x1,
  y1,
  x2,
  y2,
  startFrame,
  drawDuration = 20,
}) => {
  const frame = useCurrentFrame();

  const lineLength = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);

  const drawProgress = interpolate(
    frame,
    [startFrame, startFrame + drawDuration],
    [0, 1],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.inOut(Easing.quad),
    },
  );

  const dashOffset = lineLength * (1 - drawProgress);

  const particleProgress = interpolate(
    frame,
    [startFrame + 5, startFrame + drawDuration + 10],
    [0, 1],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.inOut(Easing.quad),
    },
  );

  const particleX = x1 + (x2 - x1) * particleProgress;
  const particleY = y1 + (y2 - y1) * particleProgress;
  const particleOpacity = interpolate(
    particleProgress,
    [0, 0.1, 0.9, 1],
    [0, 1, 1, 0],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    },
  );

  // Compute bounding box with padding for the SVG
  const pad = 10;
  const minX = Math.min(x1, x2) - pad;
  const minY = Math.min(y1, y2) - pad;
  const svgW = Math.abs(x2 - x1) + pad * 2;
  const svgH = Math.abs(y2 - y1) + pad * 2;

  return (
    <svg
      width={svgW}
      height={svgH}
      style={{ position: "absolute", left: minX, top: minY, overflow: "visible" }}
    >
      <line
        x1={x1 - minX}
        y1={y1 - minY}
        x2={x2 - minX}
        y2={y2 - minY}
        stroke={COLORS.connectionLine}
        strokeWidth={2}
        strokeDasharray={lineLength}
        strokeDashoffset={dashOffset}
        strokeLinecap="round"
      />
      {particleProgress > 0 && particleProgress < 1 && (
        <circle
          cx={particleX - minX}
          cy={particleY - minY}
          r={4}
          fill={COLORS.connectionParticle}
          opacity={particleOpacity}
        />
      )}
    </svg>
  );
};
