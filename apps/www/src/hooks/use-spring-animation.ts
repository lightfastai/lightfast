"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";

import type { SpringConfig, SpringState } from "~/lib/animation/spring-physics";
import {
  calculateSpringStep,
  clamp01,
  createSpringState,
  DEFAULT_SPRING_CONFIG,
  isSpringSettled,
} from "~/lib/animation/spring-physics";

interface SpringAnimationReturn {
  position: number;
  isAnimating: boolean;
  animateTo: (
    target: number,
    onUpdate?: (position: number) => void,
    onComplete?: () => void,
  ) => void;
  addVelocity: (velocity: number) => void;
  setPosition: (position: number) => void;
  stop: () => void;
}

export const useSpringAnimation = (
  config: Partial<SpringConfig> = {},
  minDuration = 400,
): SpringAnimationReturn => {
  const springConfig = useMemo(
    () => ({ ...DEFAULT_SPRING_CONFIG, ...config }),
    [config],
  );

  const stateRef = useRef<SpringState>(createSpringState());

  const rafIdRef = useRef<number | null>(null);
  const lastTimeRef = useRef(0);
  const startTimeRef = useRef(0);
  const onUpdateRef = useRef<((position: number) => void) | undefined>(
    undefined,
  );
  const onCompleteRef = useRef<(() => void) | undefined>(undefined);

  const step = useCallback(() => {
    const now = performance.now();
    const deltaTime = Math.min((now - lastTimeRef.current) / 1000, 0.016);
    lastTimeRef.current = now;

    const state = stateRef.current;

    // Use pure physics calculation
    const newState = calculateSpringStep(state, springConfig, deltaTime);
    stateRef.current = newState;

    // Call update callback
    onUpdateRef.current?.(newState.position);

    // Check if animation should continue
    const isSettled = isSpringSettled(newState);
    const hasAnimatedLongEnough = now - startTimeRef.current >= minDuration;

    if (!isSettled || !hasAnimatedLongEnough) {
      rafIdRef.current = requestAnimationFrame(step);
    } else {
      // Animation complete
      rafIdRef.current = null;
      stateRef.current.position = stateRef.current.target;
      onUpdateRef.current?.(stateRef.current.position);
      onCompleteRef.current?.();
    }
  }, [springConfig, minDuration]);

  const animateTo = useCallback(
    (
      target: number,
      onUpdate?: (position: number) => void,
      onComplete?: () => void,
    ) => {
      stateRef.current.target = clamp01(target);
      onUpdateRef.current = onUpdate;
      onCompleteRef.current = onComplete;

      if (rafIdRef.current === null) {
        startTimeRef.current = performance.now();
        lastTimeRef.current = startTimeRef.current;
        rafIdRef.current = requestAnimationFrame(step);
      }
    },
    [step],
  );

  const addVelocity = useCallback((velocity: number) => {
    stateRef.current.velocity += velocity;
  }, []);

  const setPosition = useCallback((position: number) => {
    const newPosition = clamp01(position);
    stateRef.current.position = newPosition;
    stateRef.current.target = newPosition;
  }, []);

  const stop = useCallback(() => {
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, []);

  return {
    position: stateRef.current.position,
    isAnimating: rafIdRef.current !== null,
    animateTo,
    addVelocity,
    setPosition,
    stop,
  } as const;
};
