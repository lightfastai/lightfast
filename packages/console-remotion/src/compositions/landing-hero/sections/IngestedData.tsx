import type React from "react";
import { useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import { IsometricCard } from "../shared/IsometricCard";
import { COLORS } from "../shared/colors";
import { FONT_FAMILY } from "../shared/fonts";
import { SPRING_CONFIGS, MOTION_DURATION, ROW_STAGGER, BEAM_TIMING } from "../shared/timing";

const SEARCH_RESULTS = [
  {
    title: "Authentication service architecture decision",
    domain: "github.com/acme/backend",
    timestamp: "3 days ago",
  },
  {
    title: "API rate limiting implementation — PR #842",
    domain: "github.com/acme/api",
    timestamp: "1 week ago",
  },
  {
    title: "User authentication flow diagram",
    domain: "notion.so/acme/docs",
    timestamp: "2 weeks ago",
  },
  {
    title: "Choosing between Clerk vs Auth0",
    domain: "slack.com/acme/engineering",
    timestamp: "3 weeks ago",
  },
  {
    title: "Payment service dependencies and ownership",
    domain: "linear.app/acme/ENG-1234",
    timestamp: "1 month ago",
  },
  {
    title: "Auth middleware refactor discussion",
    domain: "github.com/acme/backend",
    timestamp: "1 month ago",
  },
];

const PRIMARY_NAV = [
  { label: "Ask", active: true },
  { label: "Search", active: false },
];

const MANAGE_NAV = [
  { label: "Sources", active: false },
  { label: "Jobs", active: false },
  { label: "Settings", active: false },
];

const QUERY_TEXT = '"How does our authentication service work?"';
const SIDEBAR_WIDTH = 256;

const borderColor = COLORS.border;

export const IngestedData: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // ── Typewriter animation — starts after beam arrives ──
  const TYPEWRITER_START = BEAM_TIMING.ARRIVAL + 12;
  const CHARS_PER_FRAME = 1.2;
  const typingFrame = Math.max(0, frame - TYPEWRITER_START);
  const charsToShow = Math.min(
    Math.floor(typingFrame * CHARS_PER_FRAME),
    QUERY_TEXT.length,
  );
  const isTypingComplete = charsToShow >= QUERY_TEXT.length;
  const typingEndFrame =
    TYPEWRITER_START + Math.ceil(QUERY_TEXT.length / CHARS_PER_FRAME);

  // Cursor: solid during typing, blinks after, hidden after 30 frames
  const cursorFramesAfterTyping = frame - typingEndFrame;
  const showCursor =
    frame >= TYPEWRITER_START &&
    (!isTypingComplete || cursorFramesAfterTyping < 30);
  const cursorOpacity =
    showCursor && isTypingComplete
      ? Math.floor(cursorFramesAfterTyping / 8) % 2 === 0
        ? 1
        : 0
      : showCursor
        ? 1
        : 0;

  // ── Staggered results ──
  const RESULTS_START = typingEndFrame + 10;
  const RESULT_STAGGER = ROW_STAGGER.INGESTED_DATA;

  return (
    <IsometricCard
      entranceFrame={0}
      animate={false}
      width={854}
      height={512}
      x={341}
      y={1024}
    >
      <div
        style={{
          display: "flex",
          height: "100%",
          fontFamily: FONT_FAMILY,
          backgroundColor: COLORS.background,
          transformStyle: "preserve-3d",
        }}
      >
        {/* ── Sidebar ── */}
        <div
          style={{
            width: SIDEBAR_WIDTH,
            flexShrink: 0,
            borderRight: `1px solid ${borderColor}`,
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* App name */}
          <div
            style={{
              padding: "14px 14px 10px",
              borderBottom: `1px solid ${borderColor}`,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <div
              style={{
                width: 22,
                height: 22,
                borderRadius: 999,
                backgroundColor: "#ffffff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  color: "#000000",
                  lineHeight: 1,
                }}
              >
                AC
              </span>
            </div>
            <span
              style={{
                fontSize: 14,
                fontWeight: 500,
                color: COLORS.primary,
                letterSpacing: "-0.01em",
              }}
            >
              Acme
            </span>
          </div>

          {/* Primary nav */}
          <div style={{ padding: "8px 6px" }}>
            {PRIMARY_NAV.map((item) => (
              <div
                key={item.label}
                style={{
                  padding: "7px 8px",
                  borderRadius: 4,
                  fontSize: 13,
                  fontWeight: item.active ? 500 : 400,
                  color: item.active ? COLORS.text : COLORS.textMuted,
                  backgroundColor: item.active ? COLORS.cardGray : "transparent",
                  marginBottom: 2,
                }}
              >
                {item.label}
              </div>
            ))}
          </div>

          {/* Manage section */}
          <div style={{ padding: "4px 6px" }}>
            <div
              style={{
                padding: "4px 8px",
                fontSize: 11,
                fontWeight: 500,
                color: COLORS.textLight,
                letterSpacing: "0.02em",
              }}
            >
              Manage
            </div>
            {MANAGE_NAV.map((item) => (
              <div
                key={item.label}
                style={{
                  padding: "7px 8px",
                  borderRadius: 4,
                  fontSize: 13,
                  fontWeight: item.active ? 500 : 400,
                  color: item.active ? COLORS.text : COLORS.textMuted,
                  backgroundColor: item.active ? COLORS.cardGray : "transparent",
                  marginBottom: 2,
                }}
              >
                {item.label}
              </div>
            ))}
          </div>

          {/* Spacer */}
          <div style={{ flex: 1 }} />

          {/* Bottom section */}
          <div
            style={{
              padding: "10px 14px",
              borderTop: `1px solid ${borderColor}`,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <div
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: 999,
                  backgroundColor: COLORS.cardGray,
                  border: `1px solid ${borderColor}`,
                }}
              />
              <span style={{ fontSize: 12, color: COLORS.textMuted }}>
                Acme Inc
              </span>
            </div>
          </div>
        </div>

        {/* ── Main content ── */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            transformStyle: "preserve-3d",
          }}
        >
          {/* Search query section */}
          <div
            style={{
              padding: "12px 14px",
              borderBottom: `1px solid ${borderColor}`,
              minHeight: 72,
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
            }}
          >
            <div style={{ fontSize: 13, lineHeight: "18px" }}>
              <span style={{ color: COLORS.primary, fontWeight: 500 }}>lightfast</span>
              <span style={{ color: COLORS.textMuted }}>.</span>
              <span style={{ color: COLORS.text }}>search</span>
              <span style={{ color: COLORS.textMuted }}>(</span>
            </div>
            <div
              style={{
                fontSize: 13,
                lineHeight: "18px",
                paddingLeft: 16,
                color: COLORS.text,
              }}
            >
              {QUERY_TEXT.slice(0, charsToShow)}
              <span
                style={{
                  opacity: cursorOpacity,
                  color: COLORS.primary,
                  fontWeight: 300,
                }}
              >
                |
              </span>
            </div>
            <div
              style={{
                fontSize: 13,
                lineHeight: "18px",
              }}
            >
              <span style={{ color: COLORS.textMuted }}>)</span>
            </div>
          </div>

          {/* Results list */}
          <div style={{ flex: 1, transformStyle: "preserve-3d" }}>
            {SEARCH_RESULTS.map((result, index) => {
              const entrance = spring({
                frame: frame - (RESULTS_START + index * RESULT_STAGGER),
                fps,
                config: SPRING_CONFIGS.SNAPPY,
                durationInFrames: MOTION_DURATION.ROW_ENTRANCE,
              });
              const rowVisible = entrance > 0 ? 1 : 0;
              // translateZ lifts content above the isometric plane; the parent's
              // rotateX(54.7°) projects Z into screen-Y so this appears as a
              // vertical float-above → drop-down.
              const rowZ = interpolate(entrance, [0, 1], [60, 0], {
                extrapolateRight: "clamp",
              });
              const wireframeOpacity = rowVisible * interpolate(
                entrance, [0.0, 0.7, 1.0], [0.5, 0.5, 0],
                { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
              );

              return (
                <div
                  key={index}
                  style={{
                    position: "relative",
                    height: 52,
                    borderBottom:
                      index < SEARCH_RESULTS.length - 1
                        ? `1px solid ${borderColor}`
                        : undefined,
                    transformStyle: "preserve-3d",
                  }}
                >
                  {/* ── Wireframe: landing zone at z=0 ── */}
                  {wireframeOpacity > 0 && (
                    <div
                      style={{
                        position: "absolute",
                        inset: 0,
                        border: `1px dashed ${borderColor}`,
                        opacity: wireframeOpacity,
                        pointerEvents: "none",
                      }}
                    />
                  )}

                  {/* ── Row content — floats above surface, drops down ── */}
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      padding: "8px 14px",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "center",
                      opacity: rowVisible,
                      transform: `translateZ(${rowZ}px)`,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 500,
                        color: COLORS.text,
                        lineHeight: "16px",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {result.title}
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        color: COLORS.textMuted,
                        lineHeight: "16px",
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        marginTop: 2,
                      }}
                    >
                      <span>{result.domain}</span>
                      <span style={{ color: COLORS.textLight }}>|</span>
                      <span>{result.timestamp}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </IsometricCard>
  );
};
