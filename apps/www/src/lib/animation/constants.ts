/**
 * Animation timing constants - read from CSS custom properties
 * CSS is the single source of truth for timing values
 *
 * @deprecated Use useAnimationTiming() hook instead for React components
 * This file maintains backward compatibility for non-React usage
 */

// Re-export CSS timing reader for non-React usage
export {
  ANIMATION_TIMING,
  getAnimationTiming,
  refreshAnimationTiming,
} from "./css-timing";

// Re-export React hooks (recommended approach)
export {
  useAnimationTiming,
  useAnimationTimingBatch,
  useGridLineDuration,
  useGridLineDelayStep,
  useLoadingDuration,
} from "../../hooks/use-animation-timing";
