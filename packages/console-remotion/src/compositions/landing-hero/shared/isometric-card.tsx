import type React from "react";
import { useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import { SPRING_CONFIGS, MOTION_DURATION } from "./timing";

interface IsometricCardProps {
  children: React.ReactNode;
  entranceFrame: number;
  animate?: boolean;
  width: number;
  height: number;
  /** Absolute position within the isometric plane */
  x: number;
  y: number;
}

export const IsometricCard: React.FC<IsometricCardProps> = ({
  children,
  entranceFrame,
  animate = true,
  width,
  height,
  x,
  y,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const entrance = animate
    ? spring({
        frame: frame - entranceFrame,
        fps,
        config: SPRING_CONFIGS.SMOOTH,
        durationInFrames: MOTION_DURATION.CARD_ENTRANCE,
      })
    : 1;

  const translateY = interpolate(entrance, [0, 1], [40, 0]);
  const opacity = interpolate(entrance, [0, 1], [0, 1]);

  return (
    // Outer wrapper: positioning + 3D context
    <div
      className="absolute"
      style={{
        left: x,
        top: y,
        transform: `translateY(${translateY}px)`,
        opacity,
        width,
        height,
        transformStyle: "preserve-3d",
      }}
    >
      {/* Card background */}
      <div className="absolute inset-0 bg-card" />
      {/* Children — clipped to card shape */}
      <div
        className="relative h-full w-full"
        style={{ transformStyle: "preserve-3d" }}
      >
        {children}
      </div>
      {/* Border overlay — always visible on top */}
      <div className="pointer-events-none absolute inset-0 border border-border" />
    </div>
  );
};
