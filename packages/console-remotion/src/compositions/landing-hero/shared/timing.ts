import type { SpringConfig } from "remotion";

export const SPRING_CONFIGS = {
  SMOOTH: { damping: 200 } satisfies Partial<SpringConfig>,
  GENTLE: { damping: 300 } satisfies Partial<SpringConfig>,
  SNAPPY: { damping: 20, stiffness: 200 } satisfies Partial<SpringConfig>,
} as const;

/** Shared animation durations (in frames) */
export const MOTION_DURATION = {
  GRID_DRAW: 44,
  GRID_OPACITY: 22,
  CARD_ENTRANCE: 36,
  ROW_ENTRANCE: 24,
  LOGO_MARK_ENTRANCE: 28,
  LOGO_ROTATION: 240,
} as const;

/** Frame offsets for each section's entrance */
export const SECTION_TIMING = {
  /** Grid lines draw in */
  GRID: { start: -MOTION_DURATION.GRID_DRAW },
  /** Section 1: Stream events card — cell (0,1) */
  STREAM_EVENTS: { start: 6, entrance: 6 },
  /** Section 2: Logo / engine — cell (1,1) */
  LOGO: { start: 48, entrance: 48 },
  /** Bottom row — cells (2,0), (2,1), (2,2) */
  BOTTOM_LEFT: { start: 78, entrance: 78 },
  BOTTOM_CENTER: { start: 88, entrance: 88 },
  BOTTOM_RIGHT: { start: 98, entrance: 98 },
} as const;

/** Stagger delay between rows appearing inside cards */
export const ROW_STAGGER = {
  STREAM_EVENTS: 6,
  INGESTED_DATA: 24,
} as const;
