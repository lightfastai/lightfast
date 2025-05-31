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

// Custom hook to handle scroll locking during loading animations
export const useScrollLock = () => {
  useEffect(() => {
    // Calculate total loading animation duration
    // Grid lines (1.6s) + delays (0.6s) + text animation (0.6s) + buffer (0.2s)
    const loadingDuration = 3000; // 3 seconds

    // Lock scroll immediately
    document.documentElement.classList.add("landing-scroll-locked");
    document.body.classList.add("landing-scroll-locked");

    // Prevent wheel, touch, and keyboard scrolling
    const preventDefault = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
    };

    const preventKeys = (e: KeyboardEvent) => {
      // Prevent arrow keys, space, page up/down, home/end
      if ([32, 33, 34, 35, 36, 37, 38, 39, 40].includes(e.keyCode)) {
        preventDefault(e);
      }
    };

    // Add event listeners
    document.addEventListener("wheel", preventDefault, { passive: false });
    document.addEventListener("touchmove", preventDefault, { passive: false });
    document.addEventListener("keydown", preventKeys, { passive: false });

    // Release scroll lock after animations complete
    const timeoutId = setTimeout(() => {
      document.documentElement.classList.remove("landing-scroll-locked");
      document.body.classList.remove("landing-scroll-locked");

      // Remove event listeners
      document.removeEventListener("wheel", preventDefault);
      document.removeEventListener("touchmove", preventDefault);
      document.removeEventListener("keydown", preventKeys);
    }, loadingDuration);

    // Cleanup on unmount
    return () => {
      clearTimeout(timeoutId);
      document.documentElement.classList.remove("landing-scroll-locked");
      document.body.classList.remove("landing-scroll-locked");
      document.removeEventListener("wheel", preventDefault);
      document.removeEventListener("touchmove", preventDefault);
      document.removeEventListener("keydown", preventKeys);
    };
  }, []);
};

// Simplified hook that only sets viewport-based variables
// All animation calculations are now handled in CSS
export const useLandingCSSVariables = () => {
  useWheelProgress(); // Initialize wheel progress tracking

  useEffect(() => {
    const updateViewportVariables = () => {
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const root = document.documentElement;

      // Only set basic viewport and grid variables
      const containerWidth = viewportWidth - 64;
      const containerHeight = viewportHeight - 128;

      root.style.setProperty("--viewport-width", `${viewportWidth}px`);
      root.style.setProperty("--viewport-height", `${viewportHeight}px`);
      root.style.setProperty("--container-width", `${containerWidth}px`);
      root.style.setProperty("--container-height", `${containerHeight}px`);
    };

    updateViewportVariables();
    window.addEventListener("resize", updateViewportVariables);

    return () => window.removeEventListener("resize", updateViewportVariables);
  }, []);
};
