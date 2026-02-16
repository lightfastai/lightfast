import type React from "react";
import { useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import { SPRING_CONFIGS } from "./timing";
import { COLORS } from "./colors";

type IsometricCardProps = {
  children: React.ReactNode;
  entranceFrame: number;
  width: number;
  height: number;
  /** Absolute position within the isometric plane */
  x: number;
  y: number;
};

export const IsometricCard: React.FC<IsometricCardProps> = ({
  children,
  entranceFrame,
  width,
  height,
  x,
  y,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const entrance = spring({
    frame: frame - entranceFrame,
    fps,
    config: SPRING_CONFIGS.SMOOTH,
  });

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
        boxShadow: `
          0 1px 3px rgba(0,0,0,0.08),
          0 20px 40px rgba(0,0,0,0.12)
        `,
        overflow: "hidden",
      }}
    >
      {children}
    </div>
  );
};
