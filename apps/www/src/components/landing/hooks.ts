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
      if (rafIdRef.current === null) {
        rafIdRef.current = requestAnimationFrame(updateProgress);
      }
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
