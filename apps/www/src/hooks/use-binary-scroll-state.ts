"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Binary scroll state management
export type ScrollState = "initial" | "earlyAccess";

interface ScrollAccumulator {
  direction: "up" | "down" | null;
  amount: number;
  lastWheelTime: number;
  isLocked: boolean;
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
  THRESHOLD_PERCENTAGE: 5, // 5% scroll needed to trigger state change
  COOLDOWN_MS: 300, // Base cooldown period
  ANIMATION_COOLDOWN_MS: 800, // Extended cooldown during animations
  RESET_DELAY_MS: 500, // Reset accumulator after inactivity
  VELOCITY_MULTIPLIER: 0.003, // Convert wheel delta to spring velocity
  MIN_ANIMATION_DURATION_MS: 400, // Minimum time before allowing new state changes
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
    isLocked: false,
  });

  // Animation and cooldown tracking
  const rafIdRef = useRef<number | null>(null);
  const lastStateChangeRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const animationStartRef = useRef<number>(0);
  const isAnimatingRef = useRef<boolean>(false);

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
    const cooldownPeriod = isAnimatingRef.current
      ? SCROLL_CONFIG.ANIMATION_COOLDOWN_MS
      : SCROLL_CONFIG.COOLDOWN_MS;

    return now - lastStateChangeRef.current < cooldownPeriod;
  }, []);

  // Lock/unlock scroll accumulator
  const lockAccumulator = useCallback(() => {
    scrollAccumulatorRef.current.isLocked = true;
  }, []);

  const unlockAccumulator = useCallback(() => {
    scrollAccumulatorRef.current.isLocked = false;
  }, []);

  // Reset scroll accumulator
  const resetAccumulator = useCallback(() => {
    scrollAccumulatorRef.current = {
      direction: null,
      amount: 0,
      lastWheelTime: performance.now(),
      isLocked: false,
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

      // Update CSS variable with detailed logging
      const wheelProgressValue = newPosition.toString();
      document.documentElement.style.setProperty(
        "--wheel-progress",
        wheelProgressValue,
      );

      // Debug logging to track variable changes
      if (debugMode) {
        console.log(
          `[Binary Scroll] Setting --wheel-progress to ${wheelProgressValue}, target: ${state.target}, settled: ${Math.abs(newVelocity) < 0.001 && Math.abs(displacement) < 0.001}`,
        );
      }

      // Check if spring has settled
      const isSettled =
        Math.abs(newVelocity) < 0.001 && Math.abs(displacement) < 0.001;

      // Also check minimum animation duration to prevent premature settling
      const now = performance.now();
      const hasAnimatedLongEnough =
        now - animationStartRef.current >=
        SCROLL_CONFIG.MIN_ANIMATION_DURATION_MS;

      if (!isSettled || !hasAnimatedLongEnough) {
        rafIdRef.current = requestAnimationFrame((time) => {
          const dt = Math.min((time - lastTimeRef.current) / 1000, 0.016);
          lastTimeRef.current = time;
          stepSpring(dt);
        });
      } else {
        // Animation finished
        rafIdRef.current = null;
        isAnimatingRef.current = false;

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

        // Unlock accumulator after animation completes
        unlockAccumulator();

        // Monitor for external interference after our animation completes
        if (debugMode) {
          console.log(
            `[Binary Scroll] Animation COMPLETED. Final state: ${finalState}, CSS var set to: ${exactTarget}`,
          );

          // Set up post-completion monitoring
          let monitorCount = 0;
          const maxMonitorChecks = 100; // Monitor for 5 seconds after completion

          const postCompletionMonitor = () => {
            const currentCSSValue = getComputedStyle(document.documentElement)
              .getPropertyValue("--wheel-progress")
              .trim();
            const expectedValue = exactTarget.toString();

            // Also check derived variables
            const textFadePhase = getComputedStyle(document.documentElement)
              .getPropertyValue("--text-fade-phase")
              .trim();
            const earlyAccessCardPhase = getComputedStyle(
              document.documentElement,
            )
              .getPropertyValue("--early-access-card-phase")
              .trim();
            const earlyAccessTextPhase = getComputedStyle(
              document.documentElement,
            )
              .getPropertyValue("--early-access-text-phase")
              .trim();

            console.log(
              `[Monitor Check ${monitorCount}] --wheel-progress: ${currentCSSValue}, --text-fade-phase: ${textFadePhase}, --early-access-card-phase: ${earlyAccessCardPhase}, --early-access-text-phase: ${earlyAccessTextPhase}`,
            );

            if (currentCSSValue !== expectedValue) {
              console.error(
                `[INTERFERENCE DETECTED] CSS variable changed from ${expectedValue} to ${currentCSSValue} AFTER our animation completed!`,
              );
              console.error(
                `[INTERFERENCE] This confirms something else is overriding our values`,
              );
            }

            // Check if derived variables have expected values
            const expectedTextFade = (1 - exactTarget).toString();
            const expectedEarlyAccess = exactTarget.toString();

            if (textFadePhase !== expectedTextFade) {
              console.error(
                `[DERIVED VAR ISSUE] --text-fade-phase is ${textFadePhase}, expected ${expectedTextFade}`,
              );
            }
            if (earlyAccessCardPhase !== expectedEarlyAccess) {
              console.error(
                `[DERIVED VAR ISSUE] --early-access-card-phase is ${earlyAccessCardPhase}, expected ${expectedEarlyAccess}`,
              );
            }
            if (earlyAccessTextPhase !== expectedEarlyAccess) {
              console.error(
                `[DERIVED VAR ISSUE] --early-access-text-phase is ${earlyAccessTextPhase}, expected ${expectedEarlyAccess}`,
              );
            }

            monitorCount++;
            if (monitorCount < maxMonitorChecks) {
              setTimeout(postCompletionMonitor, 50); // Check every 50ms
            }
          };

          // Start monitoring 100ms after completion
          setTimeout(postCompletionMonitor, 100);
        }
      }
    },
    [progressToState],
  );

  // Start spring animation to target
  const animateToTarget = useCallback(
    (targetProgress: number) => {
      springStateRef.current.target = targetProgress;

      // Mark animation as started
      const now = performance.now();
      isAnimatingRef.current = true;
      animationStartRef.current = now;

      // Lock accumulator during animation
      lockAccumulator();

      if (rafIdRef.current === null) {
        lastTimeRef.current = now;
        rafIdRef.current = requestAnimationFrame((time) => {
          lastTimeRef.current = time;
          stepSpring(0.016);
        });
      }
    },
    [stepSpring, lockAccumulator],
  );

  // Trigger state change
  const changeState = useCallback(
    (newState: ScrollState) => {
      // Prevent state changes during animation or cooldown
      if (
        newState === currentState ||
        isInCooldown() ||
        isAnimatingRef.current
      ) {
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

      // Ignore scroll events if accumulator is locked (during animations)
      if (accumulator.isLocked || isAnimatingRef.current) {
        return;
      }

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

  // Set up wheel event listener and CSS variable monitoring
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      processScroll(e.deltaY);
    };

    // Initialize CSS variable only if not already set
    const currentValue = getComputedStyle(document.documentElement)
      .getPropertyValue("--wheel-progress")
      .trim();
    if (!currentValue || currentValue === "") {
      document.documentElement.style.setProperty("--wheel-progress", "0");
    }

    // CSS Variable Monitor (debug mode only)
    let lastKnownValue = "0";
    let cssMonitorId: number | null = null;

    if (debugMode) {
      const monitorCSSVariable = () => {
        const currentValue = getComputedStyle(document.documentElement)
          .getPropertyValue("--wheel-progress")
          .trim();
        if (currentValue !== lastKnownValue) {
          console.log(
            `[CSS Monitor] --wheel-progress changed from ${lastKnownValue} to ${currentValue} (NOT set by Binary Scroll)`,
          );
          lastKnownValue = currentValue;
        }
        cssMonitorId = requestAnimationFrame(monitorCSSVariable);
      };
      cssMonitorId = requestAnimationFrame(monitorCSSVariable);
    }

    window.addEventListener("wheel", handleWheel, { passive: false });

    return () => {
      window.removeEventListener("wheel", handleWheel);
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }
      if (cssMonitorId !== null) {
        cancelAnimationFrame(cssMonitorId);
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
        <div>Animating: ${isAnimatingRef.current ? "Yes" : "No"}</div>
        <div>Locked: ${accumulator.isLocked ? "Yes" : "No"}</div>
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
