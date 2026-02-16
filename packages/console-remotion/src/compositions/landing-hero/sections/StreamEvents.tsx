import type React from "react";
import { useCurrentFrame, interpolate, Easing } from "remotion";
import { IntegrationLogoIcons } from "@repo/ui/integration-icons";
import { COLORS } from "../shared/colors";
import { FONT_FAMILY } from "../shared/fonts";

type FeedEvent = {
  source: "Vercel" | "GitHub" | "Sentry" | "Linear";
  label: string;
  detail: string;
  extra?: string[];
};

const FEED_EVENTS: FeedEvent[] = [
  { source: "Vercel", label: "Deployment Started", detail: "web@main" },
  { source: "GitHub", label: "PR Opened", detail: "#842 search index batching" },
  {
    source: "Sentry",
    label: "Issue Created",
    detail: "LF-1128 TypeError in worker",
    extra: [
      "TypeError: Cannot read property 'index' of undefined",
      "at SearchWorker.process (worker.ts:142)",
    ],
  },
  { source: "Linear", label: "Issue Updated", detail: "MEM-302 ranking threshold" },
  { source: "Vercel", label: "Deployment Ready", detail: "api@prod-us-east-1" },
  { source: "GitHub", label: "PR Merged", detail: "#839 edge cache warmup" },
  {
    source: "Sentry",
    label: "Metric Alert",
    detail: "p95 latency crossed 240ms",
    extra: ["Current: 312ms · Threshold: 240ms", "Region: us-east-1 · Window: 5m"],
  },
  { source: "Linear", label: "Comment Added", detail: "MEM-271 rollout checklist" },
  { source: "GitHub", label: "Issue Closed", detail: "#311 stale query regression" },
  {
    source: "Vercel",
    label: "Deployment Succeeded",
    detail: "chat-worker@main",
    extra: ["Build: 42s · 3 functions · 12 static assets"],
  },
];

const SOURCE_COLORS: Record<FeedEvent["source"], string> = {
  Vercel: "#e5e5e5",
  GitHub: "#c7c7c7",
  Sentry: "#9b9b9b",
  Linear: "#7aa2ff",
};

const SOURCE_ICON_KEY: Record<FeedEvent["source"], keyof typeof IntegrationLogoIcons> = {
  Vercel: "vercel",
  GitHub: "github",
  Sentry: "sentry",
  Linear: "linear",
};

const FEED_X = 512;
const FEED_Y = 0;
const FEED_WIDTH = 512;
const FEED_HEIGHT = 512;
const FEED_PADDING_X = 14;
const COMPACT_ROW_HEIGHT = 64;
const EXTRA_LINE_HEIGHT = 13;
const EXTRA_SECTION_OVERHEAD = 10; // marginTop + gap between lines
const ROW_GAP = 8;
const FEED_PADDING_Y = ROW_GAP;
// 10 events × 30 frames = 300, divides evenly into GIF loop for seamless restart
const FRAMES_PER_EVENT = 30;
const STEP_MOVE_FRAMES = 10;
const LOOP_FRAMES = FEED_EVENTS.length * FRAMES_PER_EVENT;
const N = FEED_EVENTS.length;

// Per-event heights and pitches
const eventHeights = FEED_EVENTS.map((e) =>
  e.extra
    ? COMPACT_ROW_HEIGHT + EXTRA_SECTION_OVERHEAD + e.extra.length * EXTRA_LINE_HEIGHT
    : COMPACT_ROW_HEIGHT,
);
const eventPitches = eventHeights.map((h) => h + ROW_GAP);

// Cumulative pitch within one cycle: cumPitch[i] = sum of eventPitches[0..i-1]
const cumPitch: number[] = [0];
for (let i = 0; i < N; i++) {
  cumPitch.push(cumPitch[i]! + eventPitches[i]!);
}
const CYCLE_PITCH = cumPitch[N]!;

// Cumulative position for any virtual index (supports negative)
function getCumPosition(vi: number): number {
  const cycles = Math.floor(vi / N);
  const rem = ((vi % N) + N) % N;
  return cycles * CYCLE_PITCH + cumPitch[rem]!;
}

const ROWS_TO_RENDER =
  Math.ceil((FEED_HEIGHT - FEED_PADDING_Y * 2) / (COMPACT_ROW_HEIGHT + ROW_GAP)) +
  N * 2 +
  2;
const START_INDEX = -N;

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
  const scrollOffset =
    getCumPosition(stepIndex) + stepProgress * eventPitches[stepIndex % N]!;

  return (
    <div
      style={{
        position: "absolute",
        left: FEED_X,
        top: FEED_Y,
        width: FEED_WIDTH,
        height: FEED_HEIGHT,
        overflow: "hidden",
      }}
    >
      {Array.from({ length: ROWS_TO_RENDER }).map((_, index) => {
        const virtualIndex = index + START_INDEX;
        const normalizedIndex = ((virtualIndex % N) + N) % N;
        const event = FEED_EVENTS[normalizedIndex]!;
        const height = eventHeights[normalizedIndex]!;
        const rowTop =
          FEED_PADDING_Y + getCumPosition(virtualIndex) + scrollOffset;

        return (
          <div
            key={index}
            style={{
              position: "absolute",
              left: FEED_PADDING_X,
              top: rowTop,
              width: FEED_WIDTH - FEED_PADDING_X * 2,
              height,
              borderRadius: 2,
              border: `1px solid ${borderColor}`,
              padding: "10px 12px",
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              gap: 6,
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
              {(() => {
                const Icon = IntegrationLogoIcons[SOURCE_ICON_KEY[event.source]];
                return (
                  <Icon
                    style={{
                      width: 14,
                      height: 14,
                      color: SOURCE_COLORS[event.source],
                      flexShrink: 0,
                    }}
                  />
                );
              })()}
              <span
                style={{
                  fontSize: 14,
                  fontWeight: 500,
                  fontFamily: "monospace",
                  color: COLORS.textMuted,
                  letterSpacing: "0.02em",
                }}
              >
                {event.source}
              </span>
            </div>
            <div
              style={{
                fontSize: 14,
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
            {event.extra && (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 2,
                  marginTop: 2,
                }}
              >
                {event.extra.map((line, i) => (
                  <span
                    key={i}
                    style={{
                      fontSize: 11,
                      fontFamily: "monospace",
                      color: COLORS.textLight,
                      letterSpacing: "0.01em",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {line}
                  </span>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
