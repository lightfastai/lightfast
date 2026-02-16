import type React from "react";
import { useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import { cn } from "../../../lib/cn";
import { IsometricCard } from "../shared/isometric-card";
import {
  SPRING_CONFIGS,
  MOTION_DURATION,
  BEAM_TIMING,
} from "../shared/timing";

// ── Pre-populated items — visible from the start so the list looks full ──
const INITIAL_ITEMS = [
  {
    title: "Weekly engineering standup notes",
    domain: "notion.so/acme/meetings",
    timestamp: "2 days ago",
  },
  {
    title: "Frontend deployment pipeline overview",
    domain: "github.com/acme/infra",
    timestamp: "5 days ago",
  },
  {
    title: "Q4 performance review guidelines",
    domain: "notion.so/acme/hr",
    timestamp: "1 week ago",
  },
  {
    title: "Database migration runbook",
    domain: "github.com/acme/backend",
    timestamp: "2 weeks ago",
  },
  {
    title: "Design system component library",
    domain: "figma.com/acme/design",
    timestamp: "3 weeks ago",
  },
  {
    title: "Incident response playbook — SRE",
    domain: "notion.so/acme/sre",
    timestamp: "1 month ago",
  },
  {
    title: "Service mesh configuration guide",
    domain: "github.com/acme/platform",
    timestamp: "1 month ago",
  },
  {
    title: "On-call rotation schedule Q1",
    domain: "pagerduty.com/acme/schedules",
    timestamp: "2 months ago",
  },
];

// ── New items that push in one-by-one at the top after search ──
const NEW_SEARCH_RESULTS = [
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
const ROW_HEIGHT = 52;

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

  // ── Two-phase arrival: shift first, pause, then drop ──
  const RESULTS_START = typingEndFrame + 10;
  const ARRIVAL_INTERVAL = 38; // frames between consecutive item cycles
  const DROP_DELAY = 14; // frames after shift starts before drop begins

  // Phase 1 — shift: existing items slide down to make room
  const shiftSprings = NEW_SEARCH_RESULTS.map((_, k) => {
    const shiftFrame = RESULTS_START + k * ARRIVAL_INTERVAL;
    return spring({
      frame: frame - shiftFrame,
      fps,
      config: SPRING_CONFIGS.SNAPPY,
      durationInFrames: MOTION_DURATION.ROW_ENTRANCE,
    });
  });

  // Phase 2 — drop: new item drops in after the gap has opened
  const dropSprings = NEW_SEARCH_RESULTS.map((_, k) => {
    const dropFrame = RESULTS_START + k * ARRIVAL_INTERVAL + DROP_DELAY;
    return spring({
      frame: frame - dropFrame,
      fps,
      config: SPRING_CONFIGS.SNAPPY,
      durationInFrames: MOTION_DURATION.ROW_ENTRANCE,
    });
  });

  // Total downward shift applied to initial items (sum of shift springs)
  const totalShift = shiftSprings.reduce((a, b) => a + b, 0);

  const RESULTS_HEIGHT = INITIAL_ITEMS.length * ROW_HEIGHT;

  const renderRowContent = (item: {
    title: string;
    domain: string;
    timestamp: string;
  }) => (
    <>
      <div className="truncate text-xs font-medium leading-4 text-foreground">
        {item.title}
      </div>
      <div className="mt-1 flex items-center gap-2 text-xs leading-4 text-muted-foreground">
        <span>{item.domain}</span>
        <span className="text-muted-foreground/40">|</span>
        <span>{item.timestamp}</span>
      </div>
    </>
  );

  return (
    <IsometricCard
      entranceFrame={0}
      animate={false}
      width={854}
      height={512}
      x={341}
      y={1072}
    >
      <div
        className="flex h-full bg-background font-sans"
        style={{ transformStyle: "preserve-3d" }}
      >
        {/* ── Sidebar ── */}
        <div
          className="flex shrink-0 flex-col border-r border-border"
          style={{ width: SIDEBAR_WIDTH }}
        >
          {/* App name */}
          <div className="flex items-center gap-2 border-b border-border px-4 py-3">
            <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-white">
              <span className="text-xs font-semibold leading-none text-black">
                AC
              </span>
            </div>
            <span className="text-sm font-medium tracking-tight text-primary">
              Acme
            </span>
          </div>

          {/* Primary nav */}
          <div className="px-2 py-2">
            {PRIMARY_NAV.map((item) => (
              <div
                key={item.label}
                className={cn(
                  "mb-1 rounded-lg px-2 py-2 text-xs",
                  item.active
                    ? "bg-accent font-medium text-foreground"
                    : "font-normal text-muted-foreground",
                )}
              >
                {item.label}
              </div>
            ))}
          </div>

          {/* Manage section */}
          <div className="px-2 py-1">
            <div className="px-2 py-1 text-xs font-medium tracking-wide text-muted-foreground/70">
              Manage
            </div>
            {MANAGE_NAV.map((item) => (
              <div
                key={item.label}
                className={cn(
                  "mb-1 rounded-lg px-2 py-2 text-xs",
                  item.active
                    ? "bg-accent font-medium text-foreground"
                    : "font-normal text-muted-foreground",
                )}
              >
                {item.label}
              </div>
            ))}
          </div>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Bottom section */}
          <div className="border-t border-border px-4 py-3">
            <div className="flex items-center gap-2">
              <div className="size-5 rounded-full border border-border bg-accent" />
              <span className="text-xs text-muted-foreground">Acme Inc</span>
            </div>
          </div>
        </div>

        {/* ── Main content ── */}
        <div
          className="flex flex-1 flex-col"
          style={{ transformStyle: "preserve-3d" }}
        >
          {/* Search query section */}
          <div className="flex min-h-18 flex-col justify-center border-b border-border px-4 py-3">
            <div className="text-xs leading-normal">
              <span className="font-medium text-primary">lightfast</span>
              <span className="text-muted-foreground">.</span>
              <span className="text-foreground">search</span>
              <span className="text-muted-foreground">(</span>
            </div>
            <div className="pl-4 text-xs leading-normal text-foreground">
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
            {/* ── Clipped layer: initial items (2D only, safe to clip) ── */}
            <div className="absolute inset-0 overflow-hidden">
              {INITIAL_ITEMS.map((item, j) => {
                const slot = j + totalShift;
                const y = slot * ROW_HEIGHT;
                if (y >= RESULTS_HEIGHT) return null;

                return (
                  <div
                    key={`initial-${j}`}
                    className="absolute left-0 right-0"
                    style={{
                      height: ROW_HEIGHT,
                      transform: `translateY(${y}px)`,
                    }}
                  >
                    <div className="flex h-full flex-col justify-center border-b border-border px-4 py-2">
                      {renderRowContent(item)}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* ── New search result items (preserve-3d for drop animation) ── */}
            {NEW_SEARCH_RESULTS.map((result, i) => {
              const drop = dropSprings[i]!;
              // Only render once the drop phase begins
              if (drop <= 0) return null;

              // Slot = how many shift springs fired AFTER this one
              const shiftsAfter = shiftSprings
                .slice(i + 1)
                .reduce((a, b) => a + b, 0);
              const slot = shiftsAfter;
              const y = slot * ROW_HEIGHT;

              // 3D drop: new item floats from z=60 down to z=0
              const rowZ = interpolate(drop, [0, 1], [60, 0], {
                extrapolateRight: "clamp",
              });

              // Wireframe cage: dashed outline at landing zone
              const wireframeOpacity = interpolate(
                drop,
                [0.0, 0.7, 1.0],
                [0.8, 0.8, 0],
                { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
              );

              // Ghost: faint content preview at landing zone
              const ghostOpacity = interpolate(
                drop,
                [0, 0.8, 1.0],
                [0.35, 0.35, 0],
                { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
              );

              const landed = wireframeOpacity < 0.01;

              return (
                <div
                  key={`new-${i}`}
                  className="absolute left-0 right-0"
                  style={{
                    height: ROW_HEIGHT,
                    transform: `translateY(${y}px)`,
                    transformStyle: "preserve-3d",
                  }}
                >
                  {/* ── Wireframe: dashed landing zone at z=0 ── */}
                  {wireframeOpacity > 0 && (
                    <div
                      className="pointer-events-none absolute inset-0"
                      style={{
                        border: "1px dashed var(--muted-foreground)",
                        opacity: wireframeOpacity,
                      }}
                    />
                  )}

                  {/* ── Ghost: faint content preview at landing zone (z=0) ── */}
                  {ghostOpacity > 0 && (
                    <div
                      className="pointer-events-none absolute inset-0 flex flex-col justify-center px-4 py-2"
                      style={{ opacity: ghostOpacity }}
                    >
                      {renderRowContent(result)}
                    </div>
                  )}

                  {/* ── Tracer lines: guide rails from z=0 to z=rowZ ── */}
                  {rowZ > 0.5 &&
                    wireframeOpacity > 0 &&
                    [0, 1].map((side) => (
                      <div
                        key={`tracer-${side}`}
                        className="pointer-events-none absolute top-0"
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

                  {/* ── Floating wrapper at z=rowZ: drops into landing zone ── */}
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
                        landed && "border-b border-border",
                      )}
                      style={
                        !landed
                          ? {
                              border: `1px dashed rgba(128, 128, 128, ${wireframeOpacity})`,
                            }
                          : undefined
                      }
                    >
                      {renderRowContent(result)}
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
