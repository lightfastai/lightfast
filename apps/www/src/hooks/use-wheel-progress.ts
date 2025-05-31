"use client";

import { useEffect, useRef } from "react";

// Simplified hook that only sets a single CSS variable

export const useWheelProgress = () => {
  const accumulatedDeltaRef = useRef(0);
  const rafIdRef = useRef<number | null>(null);

  useEffect(() => {
    const maxDelta = 1000;
    const root = document.documentElement;

    // Debounced update function using RAF for 60fps max
    const updateProgress = () => {
      const progress = Math.max(
        0,
        Math.min(1, accumulatedDeltaRef.current / maxDelta),
      );
      root.style.setProperty("--wheel-progress", progress.toString());
      rafIdRef.current = null;
    };

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();

      accumulatedDeltaRef.current += e.deltaY;
      accumulatedDeltaRef.current = Math.max(
        0,
        Math.min(maxDelta, accumulatedDeltaRef.current),
      );

      // Only schedule update if not already scheduled
      rafIdRef.current ??= requestAnimationFrame(updateProgress);
    };

    // Set initial progress
    root.style.setProperty("--wheel-progress", "0");

    window.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      window.removeEventListener("wheel", handleWheel);
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, []);
};
