import type { ClassValue } from "clsx";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

import { Easing, interpolate, useCurrentFrame } from "@vendor/remotion";
import type React from "react";
import { IsometricCard } from "../shared/isometric-card";
import { BEAM_TIMING } from "../shared/timing";

// ── Search result items — 8 items × 19 frames = 152, spans [typingEndFrame, 299] ──
const RESULT_ITEMS = [
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
    title: "Auth middleware refactor discussion",
    domain: "github.com/acme/backend",
    timestamp: "1 month ago",
  },
  {
    title: "JWT refresh token rotation implementation",
    domain: "github.com/acme/backend",
    timestamp: "1 week ago",
  },
  {
    title: "OAuth2 provider comparison notes",
    domain: "notion.so/acme/docs",
    timestamp: "2 weeks ago",
  },
  {
    title: "Session hijacking vulnerability report",
    domain: "slack.com/acme/security",
    timestamp: "3 weeks ago",
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
const ROW_HEIGHT = 62;

const N = RESULT_ITEMS.length;
// 8 items × 19 frames = 152 — exactly spans the [typingEndFrame (148), 299] cycling window
const FRAMES_PER_ITEM = 19;
const LOOP_FRAMES = N * FRAMES_PER_ITEM;
const SHIFT_DURATION = 7;
const DROP_DELAY = 1;
const DROP_DURATION = 9;
const MAX_VISIBLE = 7;
const RESULTS_HEIGHT = MAX_VISIBLE * ROW_HEIGHT;
const CHARS_PER_FRAME = 1.2;

const STEP_EASING = Easing.inOut((t: number) => Easing.cubic(t));

const RowContent: React.FC<{
  item: { title: string; domain: string; timestamp: string };
}> = ({ item }) => (
  <>
    <div className="truncate font-medium text-foreground text-xs leading-4">
      {item.title}
    </div>
    <div className="mt-1 flex items-center gap-2 text-muted-foreground text-xs leading-4">
      <span>{item.domain}</span>
      <span className="text-muted-foreground/40">|</span>
      <span>{item.timestamp}</span>
    </div>
  </>
);

export const IngestedData: React.FC = () => {
  const frame = useCurrentFrame();

  // ── Typewriter — starts after beam arrives ──
  const TYPEWRITER_START = BEAM_TIMING.ARRIVAL + 12;
  const typingFrame = Math.max(0, frame - TYPEWRITER_START);
  const charsToShow = Math.min(
    Math.floor(typingFrame * CHARS_PER_FRAME),
    QUERY_TEXT.length
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

  // ── Result cycling — starts after typing completes, frozen at loopFrame=0 before ──
  // typingEndFrame = 148; window [148, 299] = 152 frames = exactly 1 LOOP_FRAMES cycle
  const loopFrame =
    frame >= typingEndFrame ? (frame - typingEndFrame) % LOOP_FRAMES : 0;
  const stepIndex = Math.floor(loopFrame / FRAMES_PER_ITEM);
  const stepFrame = loopFrame % FRAMES_PER_ITEM;

  // ── Shift progress (existing items moving down) ──
  const shiftProgress = interpolate(stepFrame, [0, SHIFT_DURATION], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: STEP_EASING,
  });

  // ── Drop progress (entering item falling from z=60) ──
  const dropProgress = interpolate(
    stepFrame - DROP_DELAY,
    [0, DROP_DURATION],
    [0, 1],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: STEP_EASING,
    }
  );

  // ── 3D drop values for entering item ──
  const rowZ = interpolate(dropProgress, [0, 1], [60, 0], {
    extrapolateRight: "clamp",
  });
  const wireframeOpacity = interpolate(
    dropProgress,
    [0.0, 0.7, 1.0],
    [0.8, 0.8, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  const ghostOpacity = interpolate(
    dropProgress,
    [0, 0.8, 1.0],
    [0.35, 0.35, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  const landed = wireframeOpacity < 0.01;

  // ── Entering item ──
  const enteringIdx = stepIndex % N;
  const enteringItem = RESULT_ITEMS[enteringIdx]!;

  return (
    <IsometricCard
      animate={false}
      entranceFrame={0}
      height={512}
      width={854}
      x={341}
      y={1072}
    >
      <div
        className="flex h-full bg-background font-sans"
        style={{ transformStyle: "preserve-3d" }}
      >
        {/* ── Sidebar ── */}
        <div
          className="flex shrink-0 flex-col border-border border-r"
          style={{ width: SIDEBAR_WIDTH }}
        >
          {/* App name */}
          <div className="flex items-center gap-2 border-border border-b px-4 py-3">
            <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-white">
              <span className="font-semibold text-black text-xs leading-none">
                AC
              </span>
            </div>
            <span className="font-medium text-primary text-sm tracking-tight">
              Acme
            </span>
          </div>

          {/* Primary nav */}
          <div className="px-2 py-2">
            {PRIMARY_NAV.map((item) => (
              <div
                className={cn(
                  "mb-1 rounded-lg px-2 py-2 text-xs",
                  item.active
                    ? "bg-accent font-medium text-foreground"
                    : "font-normal text-muted-foreground"
                )}
                key={item.label}
              >
                {item.label}
              </div>
            ))}
          </div>

          {/* Manage section */}
          <div className="px-2 py-1">
            <div className="px-2 py-1 font-medium text-muted-foreground/70 text-xs tracking-wide">
              Manage
            </div>
            {MANAGE_NAV.map((item) => (
              <div
                className={cn(
                  "mb-1 rounded-lg px-2 py-2 text-xs",
                  item.active
                    ? "bg-accent font-medium text-foreground"
                    : "font-normal text-muted-foreground"
                )}
                key={item.label}
              >
                {item.label}
              </div>
            ))}
          </div>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Bottom section */}
          <div className="border-border border-t px-4 py-3">
            <div className="flex items-center gap-2">
              <div className="size-5 rounded-full border border-border bg-accent" />
              <span className="text-muted-foreground text-xs">Acme Inc</span>
            </div>
          </div>
        </div>

        {/* ── Main content ── */}
        <div
          className="flex flex-1 flex-col"
          style={{ transformStyle: "preserve-3d" }}
        >
          {/* Search query with typewriter */}
          <div className="flex min-h-18 flex-col justify-center border-border border-b px-4 py-3">
            <div className="text-xs leading-normal">
              <span className="font-medium text-primary">lightfast</span>
              <span className="text-muted-foreground">.</span>
              <span className="text-foreground">search</span>
              <span className="text-muted-foreground">(</span>
            </div>
            <div className="pl-4 text-foreground text-xs leading-normal">
              {QUERY_TEXT.slice(0, charsToShow)}
              <span
                className="font-light text-primary"
                style={{ opacity: cursorOpacity }}
              >
                |
              </span>
            </div>
            <div className="text-xs leading-normal">
              <span className="text-muted-foreground">)</span>
            </div>
          </div>

          {/* ── Results list ── */}
          <div
            className="relative"
            style={{
              height: RESULTS_HEIGHT,
              transformStyle: "preserve-3d",
            }}
          >
            {/* ── Clipped layer: shifting items ── */}
            <div className="absolute inset-0 overflow-hidden">
              {Array.from({ length: MAX_VISIBLE }, (_, slot) => {
                const itemIdx = (((stepIndex - 1 - slot) % N) + N) % N;
                const item = RESULT_ITEMS[itemIdx]!;
                const fromY = slot * ROW_HEIGHT;
                const toY = (slot + 1) * ROW_HEIGHT;
                const y = interpolate(shiftProgress, [0, 1], [fromY, toY]);

                if (y >= RESULTS_HEIGHT) {
                  return null;
                }

                return (
                  <div
                    className="absolute right-0 left-0"
                    key={itemIdx}
                    style={{
                      height: ROW_HEIGHT,
                      transform: `translateY(${y}px)`,
                    }}
                  >
                    <div className="flex h-full flex-col justify-center border-border border-b px-4 py-2">
                      <RowContent item={item} />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* ── 3D layer: entering item with drop effect ── */}
            {dropProgress > 0 && (
              <div
                className="absolute right-0 left-0"
                style={{
                  height: ROW_HEIGHT,
                  transform: "translateY(0px)",
                  transformStyle: "preserve-3d",
                }}
              >
                {/* Wireframe: dashed landing zone at z=0 */}
                {wireframeOpacity > 0 && (
                  <div
                    className="pointer-events-none absolute inset-0"
                    style={{
                      border: "1px dashed var(--muted-foreground)",
                      opacity: wireframeOpacity,
                    }}
                  />
                )}

                {/* Ghost: faint content preview at landing zone */}
                {ghostOpacity > 0 && (
                  <div
                    className="pointer-events-none absolute inset-0 flex flex-col justify-center px-4 py-2"
                    style={{ opacity: ghostOpacity }}
                  >
                    <RowContent item={enteringItem} />
                  </div>
                )}

                {/* Tracer lines: guide rails from z=0 to z=rowZ */}
                {rowZ > 0.5 &&
                  wireframeOpacity > 0 &&
                  [0, 1].map((side) => (
                    <div
                      className="pointer-events-none absolute top-0"
                      key={`tracer-${side}`}
                      style={{
                        left: side === 0 ? 0 : undefined,
                        right: side === 1 ? 0 : undefined,
                        width: 0,
                        height: rowZ,
                        borderLeft: "1px dashed var(--muted-foreground)",
                        transform: "rotateX(90deg)",
                        transformOrigin: "0 0",
                        opacity: wireframeOpacity,
                      }}
                    />
                  ))}

                {/* Floating wrapper at z=rowZ: drops into landing zone */}
                <div
                  className="absolute inset-0"
                  style={{
                    transform: `translateZ(${rowZ}px)`,
                    transformStyle: "preserve-3d",
                  }}
                >
                  <div
                    className={cn(
                      "absolute inset-0 flex flex-col justify-center bg-background px-4 py-2",
                      landed && "border-border border-b"
                    )}
                    style={
                      landed
                        ? undefined
                        : {
                            border: `1px dashed rgba(128, 128, 128, ${wireframeOpacity})`,
                          }
                    }
                  >
                    <RowContent item={enteringItem} />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </IsometricCard>
  );
};
