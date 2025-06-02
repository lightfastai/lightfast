"use client";

import { useCallback, useRef } from "react";

export interface ScrollAccumulatorConfig {
  thresholdAmount: number;
  resetDelayMs: number;
  cooldownMs: number;
}

interface ScrollAccumulatorState {
  direction: "up" | "down" | null;
  amount: number;
  lastWheelTime: number;
  isLocked: boolean;
}

interface ScrollProcessResult {
  shouldTrigger: boolean;
  direction: "up" | "down" | null;
}

interface ScrollAccumulatorReturn {
  processScroll: (wheelDelta: number) => ScrollProcessResult;
  lock: () => void;
  unlock: () => void;
  reset: () => void;
  isLocked: boolean;
}

const DEFAULT_SCROLL_CONFIG: ScrollAccumulatorConfig = {
  thresholdAmount: 100,
  resetDelayMs: 500,
  cooldownMs: 300,
};

export const useScrollAccumulator = (
  config: Partial<ScrollAccumulatorConfig> = {},
): ScrollAccumulatorReturn => {
  const scrollConfig = { ...DEFAULT_SCROLL_CONFIG, ...config };

  const stateRef = useRef<ScrollAccumulatorState>({
    direction: null,
    amount: 0,
    lastWheelTime: 0,
    isLocked: false,
  });

  const lastTriggerTimeRef = useRef(0);

  const reset = useCallback(() => {
    stateRef.current = {
      direction: null,
      amount: 0,
      lastWheelTime: performance.now(),
      isLocked: false,
    };
  }, []);

  const lock = useCallback(() => {
    stateRef.current.isLocked = true;
  }, []);

  const unlock = useCallback(() => {
    stateRef.current.isLocked = false;
  }, []);

  const isInCooldown = useCallback(() => {
    const now = performance.now();
    return now - lastTriggerTimeRef.current < scrollConfig.cooldownMs;
  }, [scrollConfig.cooldownMs]);

  const processScroll = useCallback(
    (wheelDelta: number): ScrollProcessResult => {
      const now = performance.now();
      const state = stateRef.current;

      // Ignore if locked or in cooldown
      if (state.isLocked || isInCooldown()) {
        return { shouldTrigger: false, direction: null };
      }

      // Reset if too much time has passed
      if (now - state.lastWheelTime > scrollConfig.resetDelayMs) {
        reset();
      }

      // Determine scroll direction
      const scrollDirection: "up" | "down" = wheelDelta > 0 ? "down" : "up";

      // Reset if direction changed
      if (state.direction && state.direction !== scrollDirection) {
        reset();
      }

      // Update accumulator
      state.direction = scrollDirection;
      state.amount += Math.abs(wheelDelta);
      state.lastWheelTime = now;

      // Check if threshold reached
      const shouldTrigger = state.amount >= scrollConfig.thresholdAmount;

      if (shouldTrigger) {
        lastTriggerTimeRef.current = now;
        reset();
      }

      return {
        shouldTrigger,
        direction: shouldTrigger ? scrollDirection : null,
      } as const;
    },
    [
      scrollConfig.thresholdAmount,
      scrollConfig.resetDelayMs,
      isInCooldown,
      reset,
    ],
  );

  return {
    processScroll,
    lock,
    unlock,
    reset,
    isLocked: stateRef.current.isLocked,
  } as const;
};
