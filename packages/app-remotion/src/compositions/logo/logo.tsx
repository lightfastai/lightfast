import { lissajousPath } from "@repo/ui/lib/brand";
import { AbsoluteFill, useVideoConfig } from "@vendor/remotion";
import type React from "react";
import { useMemo } from "react";

interface LogoProps {
  strokeWidth?: number;
  transparent?: boolean;
  variant?: "dark" | "light";
}

export const Logo: React.FC<LogoProps> = ({
  transparent = false,
  strokeWidth: swOverride,
  variant = "dark",
}) => {
  const { width, height } = useVideoConfig();
  const size = Math.min(width, height);

  const padding = 0.28;
  const sw = swOverride ?? Math.max(1, Math.round(size * 0.035));

  const path = useMemo(() => lissajousPath(size, padding), [size]);

  const bgColor = variant === "light" ? "#ffffff" : "#000000";
  const strokeColor = variant === "light" ? "#000000" : "#ffffff";

  return (
    <AbsoluteFill
      style={transparent ? undefined : { backgroundColor: bgColor }}
    >
      <svg height={height} viewBox={`0 0 ${width} ${height}`} width={width}>
        <path
          d={path}
          fill="none"
          stroke={strokeColor}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={sw}
        />
      </svg>
    </AbsoluteFill>
  );
};
