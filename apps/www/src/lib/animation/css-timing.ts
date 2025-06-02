/**
 * Read animation timing from CSS custom properties
 * This ensures CSS is the single source of truth for timing values
 */

interface AnimationTiming {
  readonly GRID_LINE_DURATION: number;
  readonly GRID_LINE_DELAY_STEP: number;
  readonly TEXT_ANIMATION_DURATION: number;
  readonly ANIMATION_BUFFER: number;
  readonly LOADING_DURATION: number;
}

/**
 * Convert CSS time value to milliseconds
 */
function cssTimeToMs(cssValue: string): number {
  if (!cssValue || cssValue === "initial" || cssValue === "inherit") {
    return 0;
  }

  const numValue = parseFloat(cssValue);
  if (isNaN(numValue)) {
    return 0;
  }

  return cssValue.includes("ms") ? numValue : numValue * 1000;
}

/**
 * Read timing values from CSS custom properties
 * Fallback to default values if CSS is not available (SSR)
 */
function readCSSTimingValues(): AnimationTiming {
  // Default values for SSR or when CSS is not available
  const defaults = {
    GRID_LINE_DURATION: 1600,
    GRID_LINE_DELAY_STEP: 200,
    TEXT_ANIMATION_DURATION: 600,
    ANIMATION_BUFFER: 200,
    get LOADING_DURATION() {
      return (
        this.GRID_LINE_DURATION +
        this.GRID_LINE_DELAY_STEP * 3 +
        this.TEXT_ANIMATION_DURATION +
        this.ANIMATION_BUFFER
      );
    },
  };

  // Return defaults during SSR
  if (typeof window === "undefined" || typeof document === "undefined") {
    return defaults;
  }

  try {
    const computedStyle = getComputedStyle(document.documentElement);

    const gridLineDuration = cssTimeToMs(
      computedStyle.getPropertyValue("--grid-line-duration").trim(),
    );
    const gridLineDelayStep = cssTimeToMs(
      computedStyle.getPropertyValue("--grid-line-delay-step").trim(),
    );

    // Text animation duration and buffer are calculated values in CSS
    // We use the same values as defaults since they're not CSS custom properties
    const textAnimationDuration = 600; // 0.6s from CSS calc
    const animationBuffer = 200; // 0.2s from CSS calc

    return {
      GRID_LINE_DURATION: gridLineDuration || defaults.GRID_LINE_DURATION,
      GRID_LINE_DELAY_STEP: gridLineDelayStep || defaults.GRID_LINE_DELAY_STEP,
      TEXT_ANIMATION_DURATION: textAnimationDuration,
      ANIMATION_BUFFER: animationBuffer,
      get LOADING_DURATION() {
        return (
          this.GRID_LINE_DURATION +
          this.GRID_LINE_DELAY_STEP * 3 +
          this.TEXT_ANIMATION_DURATION +
          this.ANIMATION_BUFFER
        );
      },
    };
  } catch (error) {
    console.warn("Failed to read CSS timing values, using defaults:", error);
    return defaults;
  }
}

/**
 * Get animation timing from CSS custom properties
 * Values are cached after first read for performance
 */
let cachedTiming: AnimationTiming | null = null;

export function getAnimationTiming(): AnimationTiming {
  if (!cachedTiming) {
    cachedTiming = readCSSTimingValues();
  }
  return cachedTiming;
}

/**
 * Force refresh of cached timing values
 * Call this if CSS custom properties change at runtime
 */
export function refreshAnimationTiming(): AnimationTiming {
  cachedTiming = null;
  return getAnimationTiming();
}

/**
 * Legacy compatibility - maintains same interface as constants.ts
 */
export const ANIMATION_TIMING = new Proxy({} as AnimationTiming, {
  get(target, prop) {
    const timing = getAnimationTiming();
    return timing[prop as keyof AnimationTiming];
  },
});
