import type React from "react";
import { COLORS } from "../shared/colors";
import { FONT_FAMILY } from "../shared/fonts";

export const LogoAnimation: React.FC = () => {
  return (
    <div
      style={{
        position: "absolute",
        left: 512,
        top: 512,
      }}
    >
      <div
        style={{
          width: 512,
          height: 512,
          borderRadius: 12,
          backgroundColor: COLORS.cardWhite,
          border: `1px solid ${COLORS.border}`,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 12,
        }}
      >
        <div>
          <svg
            width={56}
            height={56}
            viewBox="0 0 56 56"
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
          }}
        >
          Lightfast
        </div>
      </div>
    </div>
  );
};
