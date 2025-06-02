"use client";

import { useEffect } from "react";

import { env } from "~/env";
import { useBinaryScrollState } from "../../hooks/use-binary-scroll-state";
import { useScrollLock } from "../../hooks/use-scroll-lock";

// Client-side component that adds interactivity to the SSR-rendered page
export function ClientInteractivity() {
  useScrollLock();

  // Move binary scroll state here to simplify architecture
  const { currentState, progress, isTransitioning } = useBinaryScrollState(
    env.NODE_ENV === "development",
  );

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
