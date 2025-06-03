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

  // Set data-visible attribute based on current state for CSS targeting
  useEffect(() => {
    const earlyAccessContainer = document.querySelector(
      ".center-card-early-access-container",
    );

    if (earlyAccessContainer) {
      if (currentState === "earlyAccess") {
        earlyAccessContainer.setAttribute("data-visible", "true");
      } else {
        earlyAccessContainer.removeAttribute("data-visible");
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
