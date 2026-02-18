import type React from "react";
import { useCurrentFrame, interpolate, Easing } from "remotion";
import { IntegrationLogoIcons } from "@repo/ui/integration-icons";

interface FeedEvent {
  source: "Vercel" | "GitHub" | "Sentry" | "Linear";
  label: string;
  detail: string;
  extra?: string[];
}

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
const ROW_GAP = 8;

// Natural height estimates for scroll-position math (content drives actual size).
// Compact: py-3(24) + source-line(20) + gap-2(8) + label-line(20) + border(2) = 74
// Extra section adds: gap-2(8) + mt-1(4) + border-t(1) + pt-2(8) + lines
const COMPACT_ROW_HEIGHT = 74;
const EXTRA_LINE_HEIGHT = 20; // text-xs leading-tight(16) + gap-1(4)
const EXTRA_SECTION_OVERHEAD = 21; // gap(8) + margin(4) + border(1) + padding(8)
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
  cumPitch.push((cumPitch[i] ?? 0) + (eventPitches[i] ?? 0));
}
const CYCLE_PITCH = cumPitch[N] ?? 0;

// Cumulative position for any virtual index (supports negative)
function getCumPosition(vi: number): number {
  const cycles = Math.floor(vi / N);
  const rem = ((vi % N) + N) % N;
  return cycles * CYCLE_PITCH + (cumPitch[rem] ?? 0);
}

const ROWS_TO_RENDER =
  Math.ceil((FEED_HEIGHT - FEED_PADDING_Y * 2) / (COMPACT_ROW_HEIGHT + ROW_GAP)) +
  N * 2 +
  2;
const START_INDEX = -N;

// Precomputed per-row static data — avoids repeated getCumPosition calls and
// new array allocations on every render frame.
const ROW_DATA = Array.from({ length: ROWS_TO_RENDER }, (_, index) => {
  const virtualIndex = index + START_INDEX;
  const normalizedIndex = ((virtualIndex % N) + N) % N;
  return {
    index,
    event: FEED_EVENTS[normalizedIndex] ?? null,
    baseCumPosition: getCumPosition(virtualIndex),
  };
});

// Module-level easing — avoids creating a new closure on every frame.
const STEP_EASING = Easing.inOut((t: number) => Easing.cubic(t));

export const StreamEvents: React.FC = () => {
  const frame = useCurrentFrame();
  const streamFrame = frame % LOOP_FRAMES;
  const stepIndex = Math.floor(streamFrame / FRAMES_PER_EVENT);
  const stepFrame = streamFrame % FRAMES_PER_EVENT;
  const stepProgress = interpolate(stepFrame, [0, STEP_MOVE_FRAMES], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: STEP_EASING,
  });
  const scrollOffset =
    getCumPosition(stepIndex) + stepProgress * (eventPitches[stepIndex % N] ?? 0);

  return (
    <div
      className="absolute overflow-hidden"
      style={{
        left: FEED_X,
        top: FEED_Y,
        width: FEED_WIDTH,
        height: FEED_HEIGHT,
      }}
    >
      {ROW_DATA.map(({ index: rowIndex, event, baseCumPosition }) => {
        if (!event) return null;
        const rowTop = FEED_PADDING_Y + baseCumPosition + scrollOffset;

        return (
          <div
            key={rowIndex}
            className="absolute flex flex-col gap-2 rounded-md border border-border px-3 py-3 font-sans"
            style={{
              left: FEED_PADDING_X,
              top: rowTop,
              width: FEED_WIDTH - FEED_PADDING_X * 2,
            }}
          >
            <div className="flex items-center gap-2">
              {(() => {
                const Icon = IntegrationLogoIcons[SOURCE_ICON_KEY[event.source]];
                return (
                  <Icon
                    className="size-4 shrink-0"
                    style={{ color: SOURCE_COLORS[event.source] }}
                  />
                );
              })()}
              <span className="font-mono text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {event.source}
              </span>
            </div>
            <div className="flex items-center gap-2 overflow-hidden text-sm">
              <span className="shrink-0 text-foreground">{event.label}</span>
              <span className="shrink-0 text-muted-foreground/40">•</span>
              <span className="truncate text-muted-foreground">{event.detail}</span>
            </div>
            {event.extra && (
              <div className="mt-1 flex flex-col gap-1 border-t border-border/50 pt-2">
                {event.extra.map((line, lineIndex) => (
                  <span
                    key={`${lineIndex}-${line}`}
                    className="truncate font-mono text-xs leading-tight text-muted-foreground/50"
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
