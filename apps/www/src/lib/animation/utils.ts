import { ANIMATION_TIMING } from "./constants";

/**
 * Utility function to validate that JavaScript constants match CSS custom properties
 * Call this during development to catch sync issues between CSS and JS timing values
 */

export const validateAnimationTiming = (): {
  isValid: boolean;
  errors: string[];
} => {
  if (typeof window === "undefined") {
    return { isValid: true, errors: [] };
  }

  const errors: string[] = [];
  const computedStyle = getComputedStyle(document.documentElement);

  // Helper to convert CSS time value to milliseconds
  const cssTimeToMs = (cssValue: string): number => {
    const numValue = parseFloat(cssValue);
    return cssValue.includes("ms") ? numValue : numValue * 1000;
  };

  // Check grid line duration
  const cssGridLineDuration = cssTimeToMs(
    computedStyle.getPropertyValue("--grid-line-duration").trim(),
  );
  if (Math.abs(cssGridLineDuration - ANIMATION_TIMING.GRID_LINE_DURATION) > 1) {
    errors.push(
      `Grid line duration mismatch: CSS=${cssGridLineDuration}ms, JS=${ANIMATION_TIMING.GRID_LINE_DURATION}ms`,
    );
  }

  // Check grid line delay step
  const cssGridLineDelayStep = cssTimeToMs(
    computedStyle.getPropertyValue("--grid-line-delay-step").trim(),
  );
  if (
    Math.abs(cssGridLineDelayStep - ANIMATION_TIMING.GRID_LINE_DELAY_STEP) > 1
  ) {
    errors.push(
      `Grid line delay step mismatch: CSS=${cssGridLineDelayStep}ms, JS=${ANIMATION_TIMING.GRID_LINE_DELAY_STEP}ms`,
    );
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};
