"use client";

import { useEffect, useMemo } from "react";

import { useSetupBinaryScrollBehavior } from "~/hooks/use-binary-scroll-state";
import { useCSSTimingVariable } from "~/hooks/use-css-timing-variable";
import { useBinaryScrollStore } from "~/stores/binary-scroll-store";
import { useScrollIndicator } from "../hooks/use-scroll-indicator";
import { useScrollLock } from "../hooks/use-scroll-lock";

// Client-side component that adds interactivity to the SSR-rendered page
export function AnimationProvider() {
  const gridLineDuration = useCSSTimingVariable("--grid-line-duration", 1600);
  const gridLineDelayStep = useCSSTimingVariable("--grid-line-delay-step", 200);
  useSetupBinaryScrollBehavior();

  // Calculate loading duration with memoization
  const loadingDuration = useMemo(() => {
    const textAnimationDuration = 600; // 0.6s
    const animationBuffer = 200; // 0.2s
    return (
      gridLineDuration +
      gridLineDelayStep * 3 +
      textAnimationDuration +
      animationBuffer
    );
  }, [gridLineDuration, gridLineDelayStep]);

  useScrollLock(loadingDuration);
  useScrollIndicator();
  const currentState = useBinaryScrollStore((state) => state.currentState);

  // Manage pointer events for the early access container
  useEffect(() => {
    const earlyAccessContainer = document.querySelector(
      ".center-card-early-access-container",
    );

    if (earlyAccessContainer) {
      // Always ensure pointer events are enabled when container is visible
      // The CSS now handles this by default, so we only need to add the class for explicit control
      if (currentState === "earlyAccess") {
        earlyAccessContainer.classList.add("pointer-events-active");
        earlyAccessContainer.classList.remove("pointer-events-disabled");
      } else {
        // Don't disable pointer events by default - let CSS handle it
        earlyAccessContainer.classList.remove("pointer-events-active");
        // Only disable if explicitly needed (which shouldn't be the case for the form)
      }
    }
  }, [currentState]);

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

  // This component renders nothing visible - it only provides interactivity
  return null;
}
