"use client";

import { cn } from "@repo/ui/lib/utils";
import { useMemo } from "react";

interface LissajousProps {
  a: number;
  b: number;
  delta?: number;
  className?: string;
  stroke?: string;
  strokeWidth?: number;
}

export function Lissajous({
  a,
  b,
  delta = Math.PI / 2,
  className,
  stroke,
  strokeWidth = 1,
}: LissajousProps) {
  const pathData = useMemo(() => {
    const points: [number, number][] = [];
    const steps = 1000;
    const amplitude = 40; // SVG coordinate space

    for (let i = 0; i <= steps; i++) {
      const t = (i / steps) * 2 * Math.PI;
      const x = amplitude * Math.sin(a * t + delta);
      const y = amplitude * Math.sin(b * t);
      points.push([x, y]);
    }

    // Create SVG path
    const pathCommands = points.map(([x, y], i) => {
      const command = i === 0 ? "M" : "L";
      return `${command} ${(x + amplitude).toFixed(2)} ${(y + amplitude).toFixed(2)}`;
    });

    return pathCommands.join(" ");
  }, [a, b, delta]);

  const viewBoxSize = 80; // 2 * amplitude

  return (
    <svg
      viewBox={`0 0 ${viewBoxSize} ${viewBoxSize}`}
      className={cn("overflow-visible", className)}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d={pathData}
        fill="none"
        stroke={stroke ?? "currentColor"}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
