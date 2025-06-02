"use client";

import { useEffect, useRef } from "react";

import { useLandingPhaseStore } from "../stores/landing-phase-store";

export function useWheelInput() {
  const wheelListenerRef = useRef<((e: WheelEvent) => void) | null>(null);

  // Use separate selectors to avoid infinite loops
  const isWheelEnabled = useLandingPhaseStore((state) => state.isWheelEnabled);
  const setProgress = useLandingPhaseStore((state) => state.setProgress);
  const globalProgress = useLandingPhaseStore((state) => state.globalProgress);
  const manualProgress = useLandingPhaseStore(
    (state) => state.config.debug.manualProgress,
  );

  useEffect(() => {
    // Don't set up wheel listener if wheel is disabled or manual progress is set
    if (!isWheelEnabled || manualProgress !== undefined) {
      return;
    }

    const maxDelta = 1000;
    let targetProgress = globalProgress;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();

      const wheelDelta = e.deltaY;
      const newTarget = Math.max(
        0,
        Math.min(1, targetProgress + wheelDelta / maxDelta),
      );

      targetProgress = newTarget;
      setProgress(newTarget);
    };

    wheelListenerRef.current = handleWheel;
    window.addEventListener("wheel", handleWheel, { passive: false });

    return () => {
      if (wheelListenerRef.current) {
        window.removeEventListener("wheel", wheelListenerRef.current);
        wheelListenerRef.current = null;
      }
    };
  }, [isWheelEnabled, globalProgress, manualProgress, setProgress]);
}
