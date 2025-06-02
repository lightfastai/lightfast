"use client";

import { useCSSTimingVariable, useCSSVariables } from "./use-css-variable";

/**
 * Animation timing interface
 */
export interface AnimationTiming {
  readonly GRID_LINE_DURATION: number;
  readonly GRID_LINE_DELAY_STEP: number;
  readonly TEXT_ANIMATION_DURATION: number;
  readonly ANIMATION_BUFFER: number;
  readonly LOADING_DURATION: number;
}

/**
 * Hook to read animation timing from CSS custom properties
 * Returns all timing values needed for animations
 */
export function useAnimationTiming(): AnimationTiming {
  const gridLineDuration = useCSSTimingVariable("--grid-line-duration", 1600);
  const gridLineDelayStep = useCSSTimingVariable("--grid-line-delay-step", 200);

  // Text animation duration and buffer are calculated values
  // These match the values used in the CSS calc() functions
  const textAnimationDuration = 600; // 0.6s
  const animationBuffer = 200; // 0.2s

  const loadingDuration =
    gridLineDuration +
    gridLineDelayStep * 3 +
    textAnimationDuration +
    animationBuffer;

  return {
    GRID_LINE_DURATION: gridLineDuration,
    GRID_LINE_DELAY_STEP: gridLineDelayStep,
    TEXT_ANIMATION_DURATION: textAnimationDuration,
    ANIMATION_BUFFER: animationBuffer,
    LOADING_DURATION: loadingDuration,
  };
}

/**
 * Hook to read multiple animation timing values at once
 * More efficient when you need several values
 */
export function useAnimationTimingBatch(): AnimationTiming {
  const timing = useCSSVariables({
    GRID_LINE_DURATION: {
      name: "--grid-line-duration",
      converter: "timeMs",
      defaultValue: 1600,
    },
    GRID_LINE_DELAY_STEP: {
      name: "--grid-line-delay-step",
      converter: "timeMs",
      defaultValue: 200,
    },
  });

  const textAnimationDuration = 600;
  const animationBuffer = 200;

  const loadingDuration =
    timing.GRID_LINE_DURATION +
    timing.GRID_LINE_DELAY_STEP * 3 +
    textAnimationDuration +
    animationBuffer;

  return {
    ...timing,
    TEXT_ANIMATION_DURATION: textAnimationDuration,
    ANIMATION_BUFFER: animationBuffer,
    LOADING_DURATION: loadingDuration,
  };
}

/**
 * Hook to read individual timing values
 * Use when you only need specific timing values
 */
export function useGridLineDuration(): number {
  return useCSSTimingVariable("--grid-line-duration", 1600);
}

export function useGridLineDelayStep(): number {
  return useCSSTimingVariable("--grid-line-delay-step", 200);
}

export function useLoadingDuration(): number {
  const { LOADING_DURATION } = useAnimationTiming();
  return LOADING_DURATION;
}
