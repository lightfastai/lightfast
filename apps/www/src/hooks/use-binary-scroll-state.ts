"use client";

import { useCallback, useEffect, useState } from "react";

import { useScrollAccumulator } from "./use-scroll-accumulator";
import { useSpringAnimation } from "./use-spring-animation";

export type ScrollState = "initial" | "earlyAccess";

interface BinaryScrollStateReturn {
  currentState: ScrollState;
  changeState: (newState: ScrollState) => void;
}

export const useBinaryScrollState = (): BinaryScrollStateReturn => {
  const [currentState, setCurrentState] = useState<ScrollState>("initial");

  // Initialize composable hooks
  const spring = useSpringAnimation();
  const accumulator = useScrollAccumulator();

  const cssVariable = "--wheel-progress";

  // Update CSS variable when spring position changes
  const updateCSSVariable = useCallback(
    (position: number) => {
      document.documentElement.style.setProperty(
        cssVariable,
        position.toString(),
      );
    },
    [cssVariable],
  );

  // Convert state to progress value (0 or 1)
  const stateToProgress = useCallback((state: ScrollState): number => {
    return state === "initial" ? 0 : 1;
  }, []);

  // Handle state changes
  const changeState = useCallback(
    (newState: ScrollState) => {
      if (newState === currentState) return;

      const targetProgress = stateToProgress(newState);

      // Add directional velocity for natural feel
      const direction = targetProgress > spring.position ? 1 : -1;
      spring.addVelocity(direction * 0.2);

      // Lock accumulator during animation
      accumulator.lock();

      // Animate to target
      spring.animateTo(targetProgress, updateCSSVariable, () => {
        // Animation complete - update state and unlock accumulator
        setCurrentState(newState);
        accumulator.unlock();
      });
    },
    [
      currentState,
      stateToProgress,
      spring.position,
      spring.addVelocity,
      spring.animateTo,
      accumulator.lock,
      accumulator.unlock,
      updateCSSVariable,
    ],
  );

  // Process wheel events
  const processScroll = useCallback(
    (wheelDelta: number) => {
      const { shouldTrigger, direction } =
        accumulator.processScroll(wheelDelta);

      if (shouldTrigger && direction) {
        if (direction === "down" && currentState === "initial") {
          changeState("earlyAccess");
        } else if (direction === "up" && currentState === "earlyAccess") {
          changeState("initial");
        }
      }
    },
    [accumulator.processScroll, currentState, changeState],
  );

  // Initialize CSS variable
  useEffect(() => {
    const current = getComputedStyle(document.documentElement)
      .getPropertyValue(cssVariable)
      .trim();
    if (!current) {
      document.documentElement.style.setProperty(cssVariable, "0");
    }
  }, [cssVariable]);

  // Set up wheel handling with raw wheel events (bypassing progress accumulation)
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      processScroll(e.deltaY);
    };

    window.addEventListener("wheel", handleWheel, { passive: false });
    return () => window.removeEventListener("wheel", handleWheel);
  }, [processScroll]);

  return {
    currentState,
    changeState,
  } as const;
};
