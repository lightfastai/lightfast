import type { SpringConfig } from "remotion";

export const SPRING_CONFIGS = {
  SMOOTH: { damping: 200 } satisfies Partial<SpringConfig>,
  GENTLE: { damping: 300 } satisfies Partial<SpringConfig>,
  SNAPPY: { damping: 20, stiffness: 200 } satisfies Partial<SpringConfig>,
} as const;

/** Frame offsets for each section's entrance */
export const SECTION_TIMING = {
  /** Section 1: Stream events card */
  STREAM_EVENTS: { start: 0, entrance: 0 },
  /** Connection line 1 */
  CONNECTION_1: { start: 30, entrance: 30 },
  /** Section 2: Logo / engine */
  LOGO: { start: 40, entrance: 40 },
  /** Connection line 2 */
  CONNECTION_2: { start: 75, entrance: 75 },
  /** Section 3: Ingested data output */
  INGESTED_DATA: { start: 85, entrance: 85 },
} as const;

/** Stagger delay between rows appearing inside cards */
export const ROW_STAGGER = {
  STREAM_EVENTS: 5,
  INGESTED_DATA: 4,
} as const;
