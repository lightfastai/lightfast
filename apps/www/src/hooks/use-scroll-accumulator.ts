"use client";

import { useCallback, useRef } from "react";

export interface ScrollAccumulatorConfig {
  thresholdAmount: number;
  resetDelayMs: number;
  cooldownMs: number;
  minConsecutiveScrolls: number;
}

interface ScrollAccumulatorState {
  direction: "up" | "down" | null;
  amount: number;
  lastWheelTime: number;
  isLocked: boolean;
  consecutiveScrollsInDirection: number;
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
  minConsecutiveScrolls: 3,
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
    consecutiveScrollsInDirection: 0,
  });

  const lastTriggerTimeRef = useRef(0);

  const reset = useCallback(() => {
    stateRef.current = {
      direction: null,
      amount: 0,
      lastWheelTime: performance.now(),
      isLocked: stateRef.current.isLocked,
      consecutiveScrollsInDirection: 0,
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

      if (state.isLocked || isInCooldown()) {
        return { shouldTrigger: false, direction: null };
      }

      if (now - state.lastWheelTime > scrollConfig.resetDelayMs) {
        reset();
      }

      const currentEventScrollDirection: "up" | "down" =
        wheelDelta > 0 ? "down" : "up";

      if (
        state.direction === null ||
        state.direction !== currentEventScrollDirection
      ) {
        state.direction = currentEventScrollDirection;
        state.amount = Math.abs(wheelDelta);
        state.consecutiveScrollsInDirection = 1;
      } else {
        state.amount += Math.abs(wheelDelta);
        state.consecutiveScrollsInDirection += 1;
      }

      state.lastWheelTime = now;

      const meetsThreshold = state.amount >= scrollConfig.thresholdAmount;
      const meetsConsecutive =
        state.consecutiveScrollsInDirection >=
        scrollConfig.minConsecutiveScrolls;

      const shouldTrigger = meetsThreshold && meetsConsecutive;

      if (shouldTrigger) {
        lastTriggerTimeRef.current = now;
        const triggeringDirection = state.direction;
        reset();
        return {
          shouldTrigger: true,
          direction: triggeringDirection,
        };
      }

      return {
        shouldTrigger: false,
        direction: null,
      };
    },
    [
      scrollConfig.thresholdAmount,
      scrollConfig.resetDelayMs,
      scrollConfig.minConsecutiveScrolls,
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
