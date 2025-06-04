"use client";

import { useCallback, useEffect, useRef } from "react";

// Base wheel configuration
interface UseWheelConfig {
  onWheel: (delta: number, progress: number) => void;
  enabled?: boolean;
  preventScroll?: boolean;
  maxDelta?: number;
  throttle?: boolean;
}

// Store integration configuration
interface UseWheelStoreConfig {
  setProgress: (progress: number) => void;
  getCurrentProgress: () => number;
  enabled?: boolean;
  maxDelta?: number;
}

// CSS variable configuration
interface UseWheelCSSConfig {
  variable?: string;
  enabled?: boolean;
}

/**
 * Base wheel handler with built-in progress tracking
 */
export const useWheel = ({
  onWheel,
  enabled = true,
  preventScroll = true,
  maxDelta = 1000,
  throttle = false,
}: UseWheelConfig): {
  progress: number;
  reset: () => void;
} => {
  const accumulatedDelta = useRef(0);
  const rafId = useRef<number | null>(null);

  const clamp = (value: number, min = 0, max = 1): number => {
    return Math.max(min, Math.min(max, value));
  };

  const executeCallback = useCallback(() => {
    const progress = clamp(accumulatedDelta.current / maxDelta);
    onWheel(accumulatedDelta.current, progress);
    rafId.current = null;
  }, [onWheel, maxDelta]);

  const handleWheel = useCallback(
    (e: WheelEvent) => {
      if (preventScroll) {
        e.preventDefault();
      }

      accumulatedDelta.current += e.deltaY;
      accumulatedDelta.current = clamp(accumulatedDelta.current, 0, maxDelta);

      if (throttle) {
        // Use RAF throttling
        rafId.current ??= requestAnimationFrame(executeCallback);
      } else {
        // Execute immediately
        executeCallback();
      }
    },
    [preventScroll, maxDelta, throttle, executeCallback],
  );

  useEffect(() => {
    if (!enabled) {
      return;
    }

    window.addEventListener("wheel", handleWheel, { passive: !preventScroll });

    return () => {
      window.removeEventListener("wheel", handleWheel);
      if (rafId.current !== null) {
        cancelAnimationFrame(rafId.current);
      }
    };
  }, [enabled, handleWheel, preventScroll]);

  return {
    progress: accumulatedDelta.current / maxDelta,
    reset: () => {
      accumulatedDelta.current = 0;
    },
  };
};

/**
 * Hook for updating CSS variables with wheel progress
 */
export const useWheelCSS = ({
  variable = "--wheel-progress",
  enabled = true,
}: UseWheelCSSConfig = {}): {
  progress: number;
  reset: () => void;
} => {
  const setCSSVariable = useCallback(
    (value: number) => {
      document.documentElement.style.setProperty(variable, value.toString());
    },
    [variable],
  );

  // Initialize CSS variable
  useEffect(() => {
    const current = getComputedStyle(document.documentElement)
      .getPropertyValue(variable)
      .trim();
    if (!current) {
      setCSSVariable(0);
    }
  }, [variable, setCSSVariable]);

  return useWheel({
    onWheel: (_, progress) => setCSSVariable(progress),
    enabled,
    throttle: true, // CSS updates should be throttled
  });
};

/**
 * Hook for integrating wheel events with store/state management
 */
export const useWheelStore = ({
  setProgress,
  getCurrentProgress,
  enabled = true,
  maxDelta = 1000,
}: UseWheelStoreConfig): {
  progress: number;
  reset: () => void;
} => {
  const targetProgressRef = useRef(getCurrentProgress());

  // Update target progress when current progress changes
  targetProgressRef.current = getCurrentProgress();

  return useWheel({
    onWheel: (delta) => {
      // Calculate new target based on current progress and delta increment
      const progressIncrement = delta / maxDelta;
      const newTarget = Math.max(
        0,
        Math.min(1, targetProgressRef.current + progressIncrement),
      );

      targetProgressRef.current = newTarget;
      setProgress(newTarget);
    },
    enabled,
    preventScroll: true,
    maxDelta,
  });
};

/**
 * Simple wheel handler that just updates a single CSS variable
 * @deprecated Use useWheelCSS instead
 */
export const useWheelProgress = (): {
  progress: number;
  reset: () => void;
} => {
  return useWheelCSS({ variable: "--wheel-progress", enabled: true });
};
