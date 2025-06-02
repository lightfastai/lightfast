"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Binary scroll state management
export type ScrollState = "initial" | "earlyAccess";

interface ScrollAccumulator {
  direction: "up" | "down" | null;
  amount: number;
  lastWheelTime: number;
}

interface SpringConfig {
  tension: number;
  friction: number;
  mass: number;
}

interface SpringState {
  position: number; // Current progress (0-1)
  velocity: number;
  target: number; // Always 0 or 1
}

// Spring configuration for smooth transitions
const SPRING_CONFIG: SpringConfig = {
  tension: 100,
  friction: 18,
  mass: 1,
};

// Scroll behavior configuration
const SCROLL_CONFIG = {
  THRESHOLD_PERCENTAGE: 5, // 5% scroll needed to trigger state change (lowered for easier triggering)
  COOLDOWN_MS: 300, // Prevent rapid state switching
  RESET_DELAY_MS: 500, // Reset accumulator after inactivity
  VELOCITY_MULTIPLIER: 0.003, // Convert wheel delta to spring velocity
};

export const useBinaryScrollState = (debugMode = false) => {
  // Current binary state
  const [currentState, setCurrentState] = useState<ScrollState>("initial");

  // Spring physics state
  const springStateRef = useRef<SpringState>({
    position: 0,
    velocity: 0,
    target: 0,
  });

  // Scroll accumulation tracking
  const scrollAccumulatorRef = useRef<ScrollAccumulator>({
    direction: null,
    amount: 0,
    lastWheelTime: 0,
  });

  // Animation and cooldown tracking
  const rafIdRef = useRef<number | null>(null);
  const lastStateChangeRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);

  // Convert state to progress value
  const stateToProgress = useCallback((state: ScrollState): number => {
    return state === "initial" ? 0 : 1;
  }, []);

  // Convert progress to state
  const progressToState = useCallback((progress: number): ScrollState => {
    return progress < 0.5 ? "initial" : "earlyAccess";
  }, []);

  // Check if we're in cooldown period
  const isInCooldown = useCallback((): boolean => {
    const now = performance.now();
    return now - lastStateChangeRef.current < SCROLL_CONFIG.COOLDOWN_MS;
  }, []);

  // Reset scroll accumulator
  const resetAccumulator = useCallback(() => {
    scrollAccumulatorRef.current = {
      direction: null,
      amount: 0,
      lastWheelTime: performance.now(),
    };
  }, []);

  // Spring physics step
  const stepSpring = useCallback(
    (deltaTime: number) => {
      const state = springStateRef.current;
      const config = SPRING_CONFIG;

      // Spring force calculation
      const displacement = state.target - state.position;
      const springForce = displacement * config.tension;
      const dampingForce = state.velocity * config.friction;

      // Apply forces (F = ma, so a = F/m)
      const acceleration = (springForce - dampingForce) / config.mass;

      // Update velocity and position
      const newVelocity = state.velocity + acceleration * deltaTime;
      let newPosition = state.position + newVelocity * deltaTime;

      // Clamp position to [0, 1] range
      newPosition = Math.max(0, Math.min(1, newPosition));

      // Update state
      springStateRef.current = {
        position: newPosition,
        velocity: newVelocity,
        target: state.target,
      };

      // Update CSS variable
      document.documentElement.style.setProperty(
        "--wheel-progress",
        newPosition.toString(),
      );

      // Check if spring has settled
      const isSettled =
        Math.abs(newVelocity) < 0.001 && Math.abs(displacement) < 0.001;

      if (!isSettled) {
        rafIdRef.current = requestAnimationFrame((time) => {
          const dt = Math.min((time - lastTimeRef.current) / 1000, 0.016);
          lastTimeRef.current = time;
          stepSpring(dt);
        });
      } else {
        rafIdRef.current = null;
        // Snap to exact target to avoid floating point precision issues
        const exactTarget = state.target;
        springStateRef.current.position = exactTarget;

        // Update CSS variable with exact target
        document.documentElement.style.setProperty(
          "--wheel-progress",
          exactTarget.toString(),
        );

        // Update state based on exact target (not potentially imprecise position)
        const finalState = progressToState(exactTarget);
        setCurrentState(finalState);
      }
    },
    [progressToState],
  );

  // Start spring animation to target
  const animateToTarget = useCallback(
    (targetProgress: number) => {
      springStateRef.current.target = targetProgress;

      if (rafIdRef.current === null) {
        lastTimeRef.current = performance.now();
        rafIdRef.current = requestAnimationFrame((time) => {
          lastTimeRef.current = time;
          stepSpring(0.016);
        });
      }
    },
    [stepSpring],
  );

  // Trigger state change
  const changeState = useCallback(
    (newState: ScrollState) => {
      if (newState === currentState || isInCooldown()) {
        return;
      }

      const targetProgress = stateToProgress(newState);
      lastStateChangeRef.current = performance.now();

      // Add some velocity based on direction for more natural feel
      const direction =
        targetProgress > springStateRef.current.position ? 1 : -1;
      springStateRef.current.velocity += direction * 0.2;

      animateToTarget(targetProgress);
      resetAccumulator();
    },
    [
      currentState,
      isInCooldown,
      stateToProgress,
      animateToTarget,
      resetAccumulator,
    ],
  );

  // Process scroll accumulation
  const processScroll = useCallback(
    (wheelDelta: number) => {
      const now = performance.now();
      const accumulator = scrollAccumulatorRef.current;

      // Reset accumulator if too much time has passed
      if (now - accumulator.lastWheelTime > SCROLL_CONFIG.RESET_DELAY_MS) {
        resetAccumulator();
        accumulator.lastWheelTime = now;
      }

      // Determine scroll direction
      const scrollDirection: "up" | "down" = wheelDelta > 0 ? "down" : "up";

      // If direction changed, reset accumulator
      if (accumulator.direction && accumulator.direction !== scrollDirection) {
        resetAccumulator();
      }

      // Update accumulator
      accumulator.direction = scrollDirection;
      accumulator.amount += Math.abs(wheelDelta);
      accumulator.lastWheelTime = now;

      // Check if threshold reached (using a more reasonable scale)
      const thresholdReached =
        accumulator.amount >= SCROLL_CONFIG.THRESHOLD_PERCENTAGE * 20; // Adjusted scale

      if (thresholdReached) {
        if (scrollDirection === "down" && currentState === "initial") {
          changeState("earlyAccess");
        } else if (scrollDirection === "up" && currentState === "earlyAccess") {
          changeState("initial");
        }
      }
    },
    [currentState, changeState, resetAccumulator],
  );

  // Set up wheel event listener
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      processScroll(e.deltaY);
    };

    // Initialize CSS variable
    document.documentElement.style.setProperty("--wheel-progress", "0");

    window.addEventListener("wheel", handleWheel, { passive: false });

    return () => {
      window.removeEventListener("wheel", handleWheel);
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, [processScroll]);

  // Debug mode effect
  useEffect(() => {
    if (!debugMode) return;

    const debugElement = document.createElement("div");
    debugElement.id = "binary-scroll-debug";
    debugElement.style.cssText = `
      position: fixed;
      top: 10px;
      left: 10px;
      background: rgba(0, 0, 0, 0.8);
      color: white;
      padding: 10px;
      border-radius: 5px;
      font-family: monospace;
      font-size: 12px;
      z-index: 10000;
      min-width: 200px;
    `;
    document.body.appendChild(debugElement);

    const updateDebug = () => {
      const spring = springStateRef.current;
      const accumulator = scrollAccumulatorRef.current;

      debugElement.innerHTML = `
        <div><strong>Binary Scroll Debug</strong></div>
        <div>State: ${currentState}</div>
        <div>Progress: ${spring.position.toFixed(3)}</div>
        <div>Target: ${spring.target}</div>
        <div>Velocity: ${spring.velocity.toFixed(3)}</div>
        <div>Scroll Dir: ${accumulator.direction || "none"}</div>
        <div>Scroll Amount: ${accumulator.amount.toFixed(0)}</div>
        <div>Threshold: ${SCROLL_CONFIG.THRESHOLD_PERCENTAGE * 20}</div>
        <div>Cooldown: ${isInCooldown() ? "Yes" : "No"}</div>
      `;

      requestAnimationFrame(updateDebug);
    };

    updateDebug();

    return () => {
      if (document.body.contains(debugElement)) {
        document.body.removeChild(debugElement);
      }
    };
  }, [debugMode, currentState, isInCooldown]);

  return {
    currentState,
    progress: springStateRef.current.position,
    isTransitioning: rafIdRef.current !== null,
    changeState, // For manual state changes (e.g., buttons)
  };
};
