import type React from "react";
import { useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import { SPRING_CONFIGS, SECTION_TIMING } from "../shared/timing";
import { COLORS } from "../shared/colors";
import { FONT_FAMILY } from "../shared/fonts";

export const LogoAnimation: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const entrance = SECTION_TIMING.LOGO.entrance;

  const platformEntrance = spring({
    frame: frame - entrance,
    fps,
    config: SPRING_CONFIGS.SMOOTH,
  });

  const logoEntrance = spring({
    frame: frame - (entrance + 8),
    fps,
    config: SPRING_CONFIGS.SNAPPY,
  });

  const platformOpacity = interpolate(platformEntrance, [0, 1], [0, 1]);
  const platformScale = interpolate(platformEntrance, [0, 1], [0.9, 1]);

  const logoScale = interpolate(logoEntrance, [0, 1], [0.5, 1]);
  const logoOpacity = interpolate(logoEntrance, [0, 1], [0, 1]);

  const rotation = interpolate(frame - entrance, [0, 150], [0, 360], {
    extrapolateRight: "extend",
  });

  return (
    <div
      style={{
        position: "absolute",
        left: 150,
        top: 350,
      }}
    >
      <div
        style={{
          width: 180,
          height: 180,
          borderRadius: 24,
          backgroundColor: COLORS.cardWhite,
          border: `1px solid ${COLORS.border}`,
          boxShadow: `
            0 2px 4px rgba(0,0,0,0.08),
            0 24px 48px rgba(0,0,0,0.15)
          `,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 12,
          opacity: platformOpacity,
          transform: `scale(${platformScale})`,
        }}
      >
        <div
          style={{
            opacity: logoOpacity,
            transform: `scale(${logoScale})`,
          }}
        >
          <svg
            width={56}
            height={56}
            viewBox="0 0 56 56"
            style={{
              transform: `rotate(${rotation}deg)`,
            }}
          >
            {[0, 60, 120, 180, 240, 300].map((angle) => (
              <line
                key={angle}
                x1={28}
                y1={28}
                x2={28 + 22 * Math.cos((angle * Math.PI) / 180)}
                y2={28 + 22 * Math.sin((angle * Math.PI) / 180)}
                stroke={COLORS.text}
                strokeWidth={2.5}
                strokeLinecap="round"
              />
            ))}
            <circle cx={28} cy={28} r={5} fill={COLORS.text} />
          </svg>
        </div>

        <div
          style={{
            fontSize: 11,
            fontWeight: 500,
            color: COLORS.textMuted,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            fontFamily: FONT_FAMILY,
            opacity: logoOpacity,
          }}
        >
          Lightfast
        </div>
      </div>
    </div>
  );
};
