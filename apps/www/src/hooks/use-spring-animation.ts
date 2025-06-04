"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

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

  // Use state for values that need to trigger re-renders
  const [position, setPosition] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);

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

    // Update state to trigger re-renders
    setPosition(newState.position);

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
      setIsAnimating(false);
      stateRef.current.position = stateRef.current.target;
      setPosition(stateRef.current.position);
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
        setIsAnimating(true);
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

  const setPositionCallback = useCallback((newPosition: number) => {
    const clampedPosition = clamp01(newPosition);
    stateRef.current.position = clampedPosition;
    stateRef.current.target = clampedPosition;
    setPosition(clampedPosition);
  }, []);

  const stop = useCallback(() => {
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
      setIsAnimating(false);
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
    position,
    isAnimating,
    animateTo,
    addVelocity,
    setPosition: setPositionCallback,
    stop,
  } as const;
};
