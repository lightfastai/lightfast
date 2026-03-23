import { lissajousPath } from "@repo/ui/lib/brand";
import { AbsoluteFill, useVideoConfig } from "@vendor/remotion";
import type React from "react";
import { useMemo } from "react";

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
