import { useState, useEffect, useCallback } from "react";

interface UseTextCycleOptions {
  /**
   * Interval between text changes in milliseconds
   * @default 500
   */
  interval?: number;
  /**
   * Whether to loop continuously or cycle once
   * @default false (cycle once)
   */
  loop?: boolean;
  /**
   * Callback when cycle completes
   */
  onComplete?: () => void;
}

/**
 * Hook to cycle through an array of text items
 *
 * @param items - Array of items to cycle through
 * @param options - Configuration options
 * @returns Current item, index, and control functions
 */
export function useTextCycle<T>(
  items: readonly T[],
  options: UseTextCycleOptions = {},
) {
  const { interval = 500, loop = false, onComplete } = options;

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isActive, setIsActive] = useState(false);

  const start = useCallback(() => {
    setCurrentIndex(0);
    setIsActive(true);
  }, []);

  const stop = useCallback(() => {
    setIsActive(false);
  }, []);

  const reset = useCallback(() => {
    setCurrentIndex(0);
    setIsActive(false);
  }, []);

  useEffect(() => {
    if (!isActive) return;

    let index = currentIndex;

    const intervalId = setInterval(() => {
      index++;

      if (index >= items.length) {
        if (loop) {
          // Loop back to start
          index = 0;
          setCurrentIndex(0);
        } else {
          // Stop at end
          clearInterval(intervalId);
          setIsActive(false);
          if (onComplete) {
            setTimeout(onComplete, 400);
          }
          return;
        }
      } else {
        setCurrentIndex(index);
      }
    }, interval);

    return () => clearInterval(intervalId);
  }, [isActive, currentIndex, items.length, interval, loop, onComplete]);

  return {
    currentItem: items[currentIndex] as T | undefined,
    currentIndex,
    isActive,
    start,
    stop,
    reset,
  };
}
