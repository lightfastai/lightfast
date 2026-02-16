import type React from "react";
import { useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import { IsometricCard } from "../shared/IsometricCard";
import { SPRING_CONFIGS, SECTION_TIMING, ROW_STAGGER } from "../shared/timing";
import { COLORS } from "../shared/colors";
import { FONT_FAMILY } from "../shared/fonts";

const MOCK_EVENTS = [
  { name: "Sarah Chen", time: "2m ago", preview: "Reviewed PR #847 — updated auth middleware" },
  { name: "Alex Rivera", time: "5m ago", preview: "Commented on RFC: event sourcing proposal" },
  { name: "Jordan Lee", time: "8m ago", preview: "Merged branch feat/search-v2 into main" },
  { name: "Priya Patel", time: "12m ago", preview: "Created issue: rate limiter edge cases" },
  { name: "Marcus Wu", time: "15m ago", preview: "Pushed 3 commits to feat/graph-traversal" },
];

export const StreamEvents: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const entrance = SECTION_TIMING.STREAM_EVENTS.entrance;

  return (
    <IsometricCard
      entranceFrame={entrance}
      width={380}
      height={320}
      x={0}
      y={0}

    >

      {/* Header */}
      <div
        style={{
          padding: "16px 20px 12px",
          borderBottom: `1px solid ${COLORS.borderLight}`,
          fontFamily: FONT_FAMILY,
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 500,
            color: COLORS.textMuted,
            letterSpacing: "0.05em",
            textTransform: "uppercase",
          }}
        >
          Live Events
        </div>
      </div>

      {/* Event rows */}
      <div style={{ padding: "8px 0" }}>
        {MOCK_EVENTS.map((event, i) => {
          const rowEntrance = spring({
            frame: frame - (entrance + 10 + i * ROW_STAGGER.STREAM_EVENTS),
            fps,
            config: SPRING_CONFIGS.SMOOTH,
          });

          const rowOpacity = interpolate(rowEntrance, [0, 1], [0, 1]);
          const rowTranslate = interpolate(rowEntrance, [0, 1], [12, 0]);

          return (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 10,
                padding: "8px 20px",
                opacity: rowOpacity,
                transform: `translateY(${rowTranslate}px)`,
                fontFamily: FONT_FAMILY,
              }}
            >
              {/* Avatar placeholder */}
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 14,
                  backgroundColor: COLORS.cardGray,
                  border: `1px solid ${COLORS.borderLight}`,
                  flexShrink: 0,
                  marginTop: 1,
                }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "baseline",
                  }}
                >
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 500,
                      color: COLORS.text,
                    }}
                  >
                    {event.name}
                  </span>
                  <span
                    style={{
                      fontSize: 10,
                      color: COLORS.textLight,
                      flexShrink: 0,
                      marginLeft: 8,
                    }}
                  >
                    {event.time}
                  </span>
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: COLORS.textMuted,
                    marginTop: 2,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {event.preview}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </IsometricCard>
  );
};
