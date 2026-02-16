import type React from "react";
import { useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import { cn } from "../../../lib/cn";
import { IsometricCard } from "../shared/IsometricCard";
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
        className="flex h-full bg-background font-sans"
        style={{ transformStyle: "preserve-3d" }}
      >
        {/* ── Sidebar ── */}
        <div
          className="flex shrink-0 flex-col border-r border-border"
          style={{ width: SIDEBAR_WIDTH }}
        >
          {/* App name */}
          <div className="flex items-center gap-[8px] border-b border-border p-[14px_14px_10px]">
            <div className="flex size-[22px] shrink-0 items-center justify-center rounded-full bg-white">
              <span className="text-[10px] font-semibold leading-none text-black">
                AC
              </span>
            </div>
            <span className="text-[14px] font-medium tracking-[-0.01em] text-primary">
              Acme
            </span>
          </div>

          {/* Primary nav */}
          <div className="p-[8px_6px]">
            {PRIMARY_NAV.map((item) => (
              <div
                key={item.label}
                className={cn(
                  "mb-[2px] rounded-[4px] p-[7px_8px] text-[13px]",
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
          <div className="p-[4px_6px]">
            <div
              className="p-[4px_8px] text-[11px] font-medium tracking-[0.02em]"
              style={{ color: "#555555" }}
            >
              Manage
            </div>
            {MANAGE_NAV.map((item) => (
              <div
                key={item.label}
                className={cn(
                  "mb-[2px] rounded-[4px] p-[7px_8px] text-[13px]",
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
          <div className="border-t border-border p-[10px_14px]">
            <div className="flex items-center gap-[6px]">
              <div className="size-[18px] rounded-full border border-border bg-accent" />
              <span className="text-[12px] text-muted-foreground">
                Acme Inc
              </span>
            </div>
          </div>
        </div>

        {/* ── Main content ── */}
        <div
          className="flex flex-1 flex-col"
          style={{ transformStyle: "preserve-3d" }}
        >
          {/* Search query section */}
          <div className="flex min-h-[72px] flex-col justify-center border-b border-border p-[12px_14px]">
            <div className="text-[13px] leading-[18px]">
              <span className="font-medium text-primary">lightfast</span>
              <span className="text-muted-foreground">.</span>
              <span className="text-foreground">search</span>
              <span className="text-muted-foreground">(</span>
            </div>
            <div className="pl-[16px] text-[13px] leading-[18px] text-foreground">
              {QUERY_TEXT.slice(0, charsToShow)}
              <span
                className="font-light text-primary"
                style={{ opacity: cursorOpacity }}
              >
                |
              </span>
            </div>
            <div className="text-[13px] leading-[18px]">
              <span className="text-muted-foreground">)</span>
            </div>
          </div>

          {/* Results list */}
          <div className="flex-1" style={{ transformStyle: "preserve-3d" }}>
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
                entrance, [0.0, 0.7, 1.0], [0.8, 0.8, 0],
                { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
              );
              // Ghost: content preview at landing zone, fades as real content arrives
              const ghostOpacity = rowVisible * interpolate(
                entrance, [0, 0.8, 1.0], [0.35, 0.35, 0],
                { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
              );

              const rowContent = (
                <>
                  <div className="truncate text-[13px] font-medium leading-[16px] text-foreground">
                    {result.title}
                  </div>
                  <div className="mt-[2px] flex items-center gap-[6px] text-[11px] leading-[16px] text-muted-foreground">
                    <span>{result.domain}</span>
                    <span style={{ color: "#555555" }}>|</span>
                    <span>{result.timestamp}</span>
                  </div>
                </>
              );

              return (
                <div
                  key={index}
                  className={cn(
                    "relative h-[52px]",
                    index < SEARCH_RESULTS.length - 1 && "border-b border-border",
                  )}
                  style={{ transformStyle: "preserve-3d" }}
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
                      className="pointer-events-none absolute inset-0 flex flex-col justify-center p-[8px_14px]"
                      style={{ opacity: ghostOpacity }}
                    >
                      {rowContent}
                    </div>
                  )}

                  {/* ── Tracer lines: guide rails from z=0 to z=rowZ ── */}
                  {rowZ > 0.5 && wireframeOpacity > 0 && (
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
                    ))
                  )}

                  {/* ── Floating wrapper at z=rowZ: outline + content ── */}
                  <div
                    className="absolute inset-0"
                    style={{
                      opacity: rowVisible,
                      transform: `translateZ(${rowZ}px)`,
                      transformStyle: "preserve-3d",
                    }}
                  >
                    {/* Row content with wireframe border */}
                    <div
                      className="absolute inset-0 flex flex-col justify-center bg-background p-[8px_14px]"
                      style={{
                        border: wireframeOpacity > 0
                          ? `1px dashed rgba(128, 128, 128, ${wireframeOpacity})`
                          : "1px solid transparent",
                      }}
                    >
                      {rowContent}
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
