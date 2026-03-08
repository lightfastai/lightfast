import { AbsoluteFill, useVideoConfig } from "@vendor/remotion";
import type React from "react";
import { useMemo } from "react";

/**
 * Lissajous parameters — same curve used in the LandingHero logo animation.
 *   x(t) = sin(3t + π/2)
 *   y(t) = sin(2t)
 */
const A = 3;
const B = 2;
const DELTA = Math.PI / 2;
const STEPS = 512;

function lissajousPath(size: number, padding: number): string {
  const center = size / 2;
  const radius = size * (0.5 - padding);

  let d = "";
  for (let i = 0; i <= STEPS; i++) {
    const t = (i / STEPS) * 2 * Math.PI;
    const x = center + radius * Math.sin(A * t + DELTA);
    const y = center + radius * Math.sin(B * t);
    d += `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
  }
  return `${d} Z`;
}

interface LogoProps {
  strokeWidth?: number;
  transparent?: boolean;
}

export const Logo: React.FC<LogoProps> = ({
  transparent = false,
  strokeWidth: swOverride,
}) => {
  const { width, height } = useVideoConfig();
  const size = Math.min(width, height);

  const padding = 0.28;
  const sw = swOverride ?? Math.max(1, Math.round(size * 0.035));

  const path = useMemo(() => lissajousPath(size, padding), [size]);

  return (
    <AbsoluteFill
      style={transparent ? undefined : { backgroundColor: "#000000" }}
    >
      <svg height={height} viewBox={`0 0 ${width} ${height}`} width={width}>
        <path
          d={path}
          fill="none"
          stroke="#ffffff"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={sw}
        />
      </svg>
    </AbsoluteFill>
  );
};
