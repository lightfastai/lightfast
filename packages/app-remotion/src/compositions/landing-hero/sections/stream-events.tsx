import { IntegrationLogoIcons } from "@repo/ui/integration-icons";
import type React from "react";
import { Easing, interpolate, useCurrentFrame } from "remotion";
import { IsometricCard } from "../shared/isometric-card";
import { ROW_STAGGER, SECTION_TIMING } from "../shared/timing";

interface FeedEvent {
  detail: string;
  extra?: string[];
  label: string;
  source: "Vercel" | "GitHub" | "Sentry" | "Linear";
}

const FEED_EVENTS: FeedEvent[] = [
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
    extra: [
      "Current: 312ms · Threshold: 240ms",
      "Region: us-east-1 · Window: 5m",
    ],
  },
];

const SOURCE_COLORS: Record<FeedEvent["source"], string> = {
  Vercel: "#e5e5e5",
  GitHub: "#c7c7c7",
  Sentry: "#9b9b9b",
  Linear: "#7aa2ff",
};

const SOURCE_ICON_KEY: Record<
  FeedEvent["source"],
  keyof typeof IntegrationLogoIcons
> = {
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
const FEED_PADDING_Y = 0;
// 6 events × 50 frames = 300, divides evenly into GIF loop for seamless restart
const FRAMES_PER_EVENT = 50;
const STEP_MOVE_FRAMES = 10;
const LOOP_FRAMES = FEED_EVENTS.length * FRAMES_PER_EVENT;
const N = FEED_EVENTS.length;

// Per-event heights and pitches
const eventHeights = FEED_EVENTS.map((e) =>
  e.extra
    ? COMPACT_ROW_HEIGHT +
      EXTRA_SECTION_OVERHEAD +
      e.extra.length * EXTRA_LINE_HEIGHT
    : COMPACT_ROW_HEIGHT
);

// Module-level easing — avoids creating a new closure on every frame.
const STEP_EASING = Easing.inOut((t: number) => Easing.cubic(t));

/**
 * For each step s, compute which event indices are visible when the
 * container is at rest (new item fully entered, no transition in progress).
 *
 * At step s, the top item is event index (s % N). Items fill downward
 * until the next would overflow the container.
 */
const MAX_CONTENT_HEIGHT = FEED_HEIGHT - FEED_PADDING_Y * 2; // 512 - 16 = 496

interface VisibleWindow {
  /** Event indices visible in this window, ordered top-to-bottom */
  indices: number[];
  /** Cumulative Y offset of each item within the container content area (top of item) */
  offsets: number[];
  /** Total content height (sum of heights + gaps between items) */
  totalHeight: number;
}

function computeVisibleWindow(newestEventIndex: number): VisibleWindow {
  const indices: number[] = [];
  const offsets: number[] = [];
  let used = 0;

  // Iterate backwards: newest event at top, older events fill downward
  for (let offset = 0; offset < N; offset++) {
    const idx = (((newestEventIndex - offset) % N) + N) % N;
    const h = eventHeights[idx] ?? 0;

    // Check if this item fits (account for gap if not the first)
    const gapNeeded = indices.length > 0 ? ROW_GAP : 0;
    if (used + gapNeeded + h > MAX_CONTENT_HEIGHT) {
      break;
    }

    offsets.push(used + gapNeeded);
    used += gapNeeded + h;
    indices.push(idx);
  }

  return { indices, offsets, totalHeight: used };
}

/** Precomputed visible windows for every step in the cycle */
const WINDOWS: VisibleWindow[] = Array.from({ length: N }, (_, s) =>
  computeVisibleWindow(s)
);

export const StreamEvents: React.FC = () => {
  const frame = useCurrentFrame();

  // ── Step timing (unchanged) ──
  const streamFrame = frame % LOOP_FRAMES;
  const stepIndex = Math.floor(streamFrame / FRAMES_PER_EVENT);
  const stepFrame = streamFrame % FRAMES_PER_EVENT;

  // ── Windows: current resting state and the next one ──
  const currWindow = WINDOWS[stepIndex % N]!;
  const nextWindow = WINDOWS[(stepIndex + 1) % N]!;

  // ── Build render list: bottom-to-top cascade ──
  // Wave order: bottom item exits first, then items above cascade down, new item enters last.
  const renderItems: Array<{
    eventIndex: number;
    event: FeedEvent;
    fromY: number | null; // null = entering (not in current window)
    toY: number | null; // null = exiting (slides to FEED_HEIGHT)
    waveIndex: number;
  }> = [];

  const currIndexSet = new Set(currWindow.indices);
  const nextIndexSet = new Set(nextWindow.indices);
  let waveIdx = 0;

  // 1. Exiting items: bottom-to-top in currWindow (highest index = bottom = first to move)
  for (let ci = currWindow.indices.length - 1; ci >= 0; ci--) {
    const idx = currWindow.indices[ci]!;
    if (nextIndexSet.has(idx)) {
      continue;
    }
    renderItems.push({
      eventIndex: idx,
      event: FEED_EVENTS[idx]!,
      fromY: FEED_PADDING_Y + (currWindow.offsets[ci] ?? 0),
      toY: null,
      waveIndex: waveIdx++,
    });
  }

  // 2. Staying items: bottom-to-top in currWindow (shift down to their nextWindow position)
  for (let ci = currWindow.indices.length - 1; ci >= 0; ci--) {
    const idx = currWindow.indices[ci]!;
    if (!nextIndexSet.has(idx)) {
      continue;
    }
    const ni = nextWindow.indices.indexOf(idx);
    renderItems.push({
      eventIndex: idx,
      event: FEED_EVENTS[idx]!,
      fromY: FEED_PADDING_Y + (currWindow.offsets[ci] ?? 0),
      toY: FEED_PADDING_Y + (nextWindow.offsets[ni] ?? 0),
      waveIndex: waveIdx++,
    });
  }

  // 3. Entering items: in nextWindow but not currWindow (new event at top, enters last)
  for (let ni = 0; ni < nextWindow.indices.length; ni++) {
    const idx = nextWindow.indices[ni]!;
    if (currIndexSet.has(idx)) {
      continue;
    }
    renderItems.push({
      eventIndex: idx,
      event: FEED_EVENTS[idx]!,
      fromY: null,
      toY: FEED_PADDING_Y + (nextWindow.offsets[ni] ?? 0),
      waveIndex: waveIdx++,
    });
  }

  return (
    <IsometricCard
      animate={false}
      entranceFrame={SECTION_TIMING.STREAM_EVENTS.entrance}
      height={FEED_HEIGHT}
      transparent
      width={FEED_WIDTH}
      x={FEED_X}
      y={FEED_Y}
    >
      <div className="relative h-full w-full overflow-hidden">
        {renderItems.map(({ eventIndex, event, fromY, toY, waveIndex }) => {
          // ── Per-row wave progress ──
          const waveDelay = waveIndex * ROW_STAGGER.STREAM_EVENTS;
          const rowProgress = interpolate(
            stepFrame - waveDelay,
            [0, STEP_MOVE_FRAMES],
            [0, 1],
            {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: STEP_EASING,
            }
          );

          // ── Compute Y position ──
          let y: number;

          if (fromY !== null && toY !== null) {
            // Staying item: shift downward to new position
            y = interpolate(rowProgress, [0, 1], [fromY, toY as number]);
          } else if (fromY === null && toY !== null) {
            // Entering from top: slide down from above container
            const entryStartY = -(
              eventHeights[eventIndex] ?? COMPACT_ROW_HEIGHT
            );
            y = interpolate(rowProgress, [0, 1], [entryStartY, toY as number]);
          } else if (fromY !== null && toY === null) {
            // Exiting: slide down off the bottom
            y = interpolate(rowProgress, [0, 1], [fromY, FEED_HEIGHT]);
            if (y >= FEED_HEIGHT) {
              return null;
            }
          } else {
            return null;
          }

          // Don't render if fully above container (still entering)
          if (y + (eventHeights[eventIndex] ?? 0) < 0) {
            return null;
          }

          return (
            <div
              className="absolute flex flex-col gap-2 rounded-md border border-border px-3 py-3 font-sans"
              key={eventIndex}
              style={{
                left: FEED_PADDING_X,
                top: y,
                width: FEED_WIDTH - FEED_PADDING_X * 2,
              }}
            >
              <div className="flex items-center gap-2">
                {(() => {
                  const Icon =
                    IntegrationLogoIcons[SOURCE_ICON_KEY[event.source]];
                  return (
                    <Icon
                      className="size-4 shrink-0"
                      style={{ color: SOURCE_COLORS[event.source] }}
                    />
                  );
                })()}
                <span className="font-medium font-mono text-muted-foreground text-xs uppercase tracking-wide">
                  {event.source}
                </span>
              </div>
              <div className="flex items-center gap-2 overflow-hidden text-sm">
                <span className="shrink-0 text-foreground">{event.label}</span>
                <span className="shrink-0 text-muted-foreground/40">•</span>
                <span className="truncate text-muted-foreground">
                  {event.detail}
                </span>
              </div>
              {event.extra && (
                <div className="mt-1 flex flex-col gap-1 border-border/50 border-t pt-2">
                  {event.extra.map((line, lineIndex) => (
                    <span
                      className="truncate font-mono text-muted-foreground/50 text-xs leading-tight"
                      key={`${lineIndex}-${line}`}
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
    </IsometricCard>
  );
};
