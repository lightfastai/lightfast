import type React from "react";
import { useCurrentFrame, interpolate, Easing } from "remotion";
import { COLORS } from "../shared/colors";
import { FONT_FAMILY } from "../shared/fonts";

type FeedEvent = {
  source: "Vercel" | "GitHub" | "Sentry" | "Linear";
  label: string;
  detail: string;
};

const FEED_EVENTS: FeedEvent[] = [
  { source: "Vercel", label: "Deployment Started", detail: "web@main" },
  { source: "GitHub", label: "PR Opened", detail: "#842 search index batching" },
  { source: "Sentry", label: "Issue Created", detail: "LF-1128 TypeError in worker" },
  { source: "Linear", label: "Issue Updated", detail: "MEM-302 ranking threshold" },
  { source: "Vercel", label: "Deployment Ready", detail: "api@prod-us-east-1" },
  { source: "GitHub", label: "PR Merged", detail: "#839 edge cache warmup" },
  { source: "Sentry", label: "Metric Alert", detail: "p95 latency crossed 240ms" },
  { source: "Linear", label: "Comment Added", detail: "MEM-271 rollout checklist" },
  { source: "GitHub", label: "Issue Closed", detail: "#311 stale query regression" },
  { source: "Vercel", label: "Deployment Succeeded", detail: "chat-worker@main" },
];

const SOURCE_COLORS: Record<FeedEvent["source"], string> = {
  Vercel: "#e5e5e5",
  GitHub: "#c7c7c7",
  Sentry: "#9b9b9b",
  Linear: "#7aa2ff",
};

const FEED_X = 512;
const FEED_Y = 0;
const FEED_WIDTH = 512;
const FEED_HEIGHT = 512;
const FEED_PADDING_X = 14;
const ROW_HEIGHT = 52;
const ROW_GAP = 8;
const ROW_PITCH = ROW_HEIGHT + ROW_GAP;
const FEED_PADDING_Y = ROW_GAP;
const FRAMES_PER_EVENT = 30;
const STEP_MOVE_FRAMES = 10;
const LOOP_FRAMES = FEED_EVENTS.length * FRAMES_PER_EVENT;
const ROWS_TO_RENDER =
  Math.ceil((FEED_HEIGHT - FEED_PADDING_Y * 2) / ROW_PITCH) + FEED_EVENTS.length * 2 + 2;
const START_INDEX = -FEED_EVENTS.length;

const borderColor = COLORS.border;

export const StreamEvents: React.FC = () => {
  const frame = useCurrentFrame();
  const streamFrame = frame % LOOP_FRAMES;
  const stepIndex = Math.floor(streamFrame / FRAMES_PER_EVENT);
  const stepFrame = streamFrame % FRAMES_PER_EVENT;
  const stepProgress = interpolate(stepFrame, [0, STEP_MOVE_FRAMES], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.cubic),
  });
  const scrollOffset = (stepIndex + stepProgress) * ROW_PITCH;

  return (
    <div
      style={{
        position: "absolute",
        left: FEED_X,
        top: FEED_Y,
        width: FEED_WIDTH,
        height: FEED_HEIGHT,
        overflow: "hidden",
        WebkitMaskImage: `linear-gradient(to bottom, transparent 0%, black ${ROW_PITCH}px, black ${FEED_HEIGHT - ROW_PITCH}px, transparent 100%)`,
        maskImage: `linear-gradient(to bottom, transparent 0%, black ${ROW_PITCH}px, black ${FEED_HEIGHT - ROW_PITCH}px, transparent 100%)`,
      }}
    >
      {Array.from({ length: ROWS_TO_RENDER }).map((_, index) => {
        const virtualIndex = index + START_INDEX;
        const normalizedIndex =
          ((virtualIndex % FEED_EVENTS.length) + FEED_EVENTS.length) % FEED_EVENTS.length;
        const event = FEED_EVENTS[normalizedIndex]!;
        const rowTop = FEED_PADDING_Y + virtualIndex * ROW_PITCH + scrollOffset;

        return (
          <div
            key={index}
            style={{
              position: "absolute",
              left: FEED_PADDING_X,
              top: rowTop,
              width: FEED_WIDTH - FEED_PADDING_X * 2,
              height: ROW_HEIGHT,
              borderRadius: 2,
              border: `1px solid ${borderColor}`,
              padding: "10px 12px",
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              gap: 2,
              fontFamily: FONT_FAMILY,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 999,
                  backgroundColor: SOURCE_COLORS[event.source],
                  flexShrink: 0,
                }}
              />
              <span
                style={{
                  fontSize: 9,
                  fontWeight: 500,
                  color: COLORS.textMuted,
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                }}
              >
                {event.source}
              </span>
            </div>
            <div
              style={{
                fontSize: 11,
                color: COLORS.text,
                display: "flex",
                alignItems: "center",
                gap: 6,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              <span style={{ color: COLORS.text }}>{event.label}</span>
              <span style={{ color: COLORS.textLight }}>•</span>
              <span style={{ color: COLORS.textMuted }}>{event.detail}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
};
