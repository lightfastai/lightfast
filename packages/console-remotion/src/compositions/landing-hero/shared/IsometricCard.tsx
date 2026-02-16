import type React from "react";
import { useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import { SPRING_CONFIGS, MOTION_DURATION } from "./timing";
import { COLORS } from "./colors";

type IsometricCardProps = {
  children: React.ReactNode;
  entranceFrame: number;
  animate?: boolean;
  width: number;
  height: number;
  /** Absolute position within the isometric plane */
  x: number;
  y: number;
  /** Optional CSS mask to fade the card edges */
  maskImage?: string;
};

export const IsometricCard: React.FC<IsometricCardProps> = ({
  children,
  entranceFrame,
  animate = true,
  width,
  height,
  x,
  y,
  maskImage,
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
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        transform: `translateY(${translateY}px)`,
        opacity,
        width,
        height,
        backgroundColor: COLORS.cardWhite,
        borderRadius: 12,
        border: `1px solid ${COLORS.border}`,
        overflow: "hidden",
        ...(maskImage && {
          WebkitMaskImage: maskImage,
          maskImage,
        }),
      }}
    >
      {children}
    </div>
  );
};
