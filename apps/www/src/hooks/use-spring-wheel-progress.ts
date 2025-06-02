"use client";

import { useCallback, useEffect, useRef } from "react";

// Spring physics interfaces
interface SpringState {
  position: number; // Current progress (0-1)
  velocity: number; // Current velocity
  target: number; // Where we want to be
}

interface SpringConfig {
  tension: number; // Spring tightness (50-300)
  friction: number; // Damping (8-20)
  mass: number; // Object mass (0.5-2)
  allowOvershoot: boolean; // Can go past 0/1 boundaries
  momentum: number; // Velocity carry-forward (0-1)
}

interface SectionConfig {
  range: [number, number];
  spring: SpringConfig;
  boundaries: {
    allowNegative: boolean;
    allowExceed: boolean;
  };
}

// Section-specific spring configurations
const SPRING_CONFIGS: Record<string, SectionConfig> = {
  textFade: {
    range: [0, 0.3],
    spring: {
      tension: 120,
      friction: 14,
      mass: 1,
      allowOvershoot: false,
      momentum: 0.3,
    },
    boundaries: { allowNegative: false, allowExceed: false },
  },
  earlyAccessCard: {
    range: [0.3, 0.5],
    spring: {
      tension: 140,
      friction: 15,
      mass: 1,
      allowOvershoot: false,
      momentum: 0.6,
    },
    boundaries: { allowNegative: false, allowExceed: false },
  },
  earlyAccessText: {
    range: [0.5, 0.7],
    spring: {
      tension: 120,
      friction: 18,
      mass: 1,
      allowOvershoot: false,
      momentum: 0.4,
    },
    boundaries: { allowNegative: false, allowExceed: false },
  },
  logoMove: {
    range: [0.1, 0.5],
    spring: {
      tension: 180,
      friction: 12,
      mass: 1,
      allowOvershoot: false,
      momentum: 0.8,
    },
    boundaries: { allowNegative: false, allowExceed: true },
  },
  expansion: {
    range: [0.6, 0.8],
    spring: {
      tension: 200,
      friction: 10,
      mass: 1,
      allowOvershoot: true,
      momentum: 0.5,
    },
    boundaries: { allowNegative: true, allowExceed: true },
  },
  category: {
    range: [0.7, 1.0],
    spring: {
      tension: 160,
      friction: 16,
      mass: 1,
      allowOvershoot: false,
      momentum: 0.7,
    },
    boundaries: { allowNegative: true, allowExceed: false },
  },
};

// Global tweaking parameters for easy experimentation
const SPRING_TWEAKS = {
  globalTension: 1.0, // Multiply all tension values
  globalFriction: 1.0, // Multiply all friction values
  interpolationSpeed: 0.1, // How fast configs blend (0.05-0.2)
  bounceIntensity: 1.0, // Scale boundary overshoot
  velocityMultiplier: 0.001, // Scale wheel delta to velocity
};

export const useSpringWheelProgress = (debugMode = false) => {
  // Spring state
  const springStateRef = useRef<SpringState>({
    position: 0,
    velocity: 0,
    target: 0,
  });

  // Current active spring config
  const currentConfigRef = useRef<SpringConfig>({
    tension: 150,
    friction: 15,
    mass: 1,
    allowOvershoot: false,
    momentum: 0.5,
  });

  // Animation frame tracking
  const rafIdRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);

  // Velocity calculation from wheel events
  const lastWheelTimeRef = useRef<number>(0);
  const wheelVelocityRef = useRef<number>(0);

  // Get active section based on current position
  const getActiveSection = useCallback((position: number): SectionConfig => {
    for (const [name, config] of Object.entries(SPRING_CONFIGS)) {
      const [start, end] = config.range;
      if (position >= start && position <= end) {
        return config;
      }
    }
    // Default to middle section if no match
    return SPRING_CONFIGS.expansion!;
  }, []);

  // Interpolate between two spring configs
  const interpolateConfig = useCallback(
    (from: SpringConfig, to: SpringConfig, factor: number): SpringConfig => {
      const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

      return {
        tension:
          lerp(from.tension, to.tension, factor) * SPRING_TWEAKS.globalTension,
        friction:
          lerp(from.friction, to.friction, factor) *
          SPRING_TWEAKS.globalFriction,
        mass: lerp(from.mass, to.mass, factor),
        allowOvershoot: factor > 0.5 ? to.allowOvershoot : from.allowOvershoot,
        momentum: lerp(from.momentum, to.momentum, factor),
      };
    },
    [],
  );

  // Update spring configuration based on current position
  const updateSpringConfig = useCallback(() => {
    const { position } = springStateRef.current;
    const targetSection = getActiveSection(position);
    const targetConfig = targetSection.spring;
    const currentConfig = currentConfigRef.current;

    // Gradually interpolate to new config
    const newConfig = interpolateConfig(
      currentConfig,
      targetConfig,
      SPRING_TWEAKS.interpolationSpeed,
    );

    currentConfigRef.current = newConfig;
  }, [getActiveSection, interpolateConfig]);

  // Apply boundary constraints based on active section
  const applyBoundaryConstraints = useCallback(
    (position: number, velocity: number) => {
      const activeSection = getActiveSection(position);
      const { boundaries } = activeSection;

      let constrainedPosition = position;
      let constrainedVelocity = velocity;

      // Handle lower boundary (0)
      if (position < 0) {
        if (boundaries.allowNegative) {
          // Allow overshoot with bounce
          const overshoot = Math.abs(position);
          constrainedPosition =
            -overshoot * SPRING_TWEAKS.bounceIntensity * 0.3; // Reduce overshoot
          constrainedVelocity = velocity * -0.7; // Bounce back with reduced velocity
        } else {
          // Hard clamp
          constrainedPosition = 0;
          constrainedVelocity = 0;
        }
      }

      // Handle upper boundary (1)
      if (position > 1) {
        if (boundaries.allowExceed) {
          // Allow overshoot with bounce
          const overshoot = position - 1;
          constrainedPosition =
            1 + overshoot * SPRING_TWEAKS.bounceIntensity * 0.3;
          constrainedVelocity = velocity * -0.7;
        } else {
          // Hard clamp
          constrainedPosition = 1;
          constrainedVelocity = 0;
        }
      }

      return { position: constrainedPosition, velocity: constrainedVelocity };
    },
    [getActiveSection],
  );

  // Spring physics step
  const stepSpring = useCallback(
    (deltaTime: number) => {
      const state = springStateRef.current;
      const config = currentConfigRef.current;

      // Spring force calculation
      const displacement = state.target - state.position;
      const springForce = displacement * config.tension;
      const dampingForce = state.velocity * config.friction;

      // Apply forces (F = ma, so a = F/m)
      const acceleration = (springForce - dampingForce) / config.mass;

      // Update velocity and position
      let newVelocity = state.velocity + acceleration * deltaTime;
      let newPosition = state.position + newVelocity * deltaTime;

      // Apply boundary constraints
      const constrained = applyBoundaryConstraints(newPosition, newVelocity);
      newPosition = constrained.position;
      newVelocity = constrained.velocity;

      // Update state
      springStateRef.current = {
        position: newPosition,
        velocity: newVelocity,
        target: state.target,
      };

      // Update CSS variable
      const clampedProgress = Math.max(0, Math.min(1, newPosition));
      document.documentElement.style.setProperty(
        "--wheel-progress",
        clampedProgress.toString(),
      );

      // Update spring config for next frame
      updateSpringConfig();

      // Check if spring has settled (stop animation when nearly still)
      const isSettled =
        Math.abs(newVelocity) < 0.001 && Math.abs(displacement) < 0.001;

      if (!isSettled) {
        rafIdRef.current = requestAnimationFrame((time) => {
          const dt = Math.min((time - lastTimeRef.current) / 1000, 0.016); // Cap at 60fps
          lastTimeRef.current = time;
          stepSpring(dt);
        });
      } else {
        rafIdRef.current = null;
      }
    },
    [applyBoundaryConstraints, updateSpringConfig],
  );

  // Start spring animation
  const startSpringAnimation = useCallback(() => {
    if (rafIdRef.current === null) {
      lastTimeRef.current = performance.now();
      rafIdRef.current = requestAnimationFrame((time) => {
        lastTimeRef.current = time;
        stepSpring(0.016); // Start with 60fps delta
      });
    }
  }, [stepSpring]);

  useEffect(() => {
    const maxDelta = 1000; // Same as original for wheel input scaling
    const root = document.documentElement;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();

      const currentTime = performance.now();
      const deltaTime = currentTime - lastWheelTimeRef.current;
      lastWheelTimeRef.current = currentTime;

      // Calculate velocity from wheel delta
      const wheelDelta = e.deltaY;
      const targetDelta = Math.max(
        0,
        Math.min(
          maxDelta,
          springStateRef.current.target * maxDelta + wheelDelta,
        ),
      );

      // Update target position
      const newTarget = targetDelta / maxDelta;
      springStateRef.current.target = newTarget;

      // Add velocity from wheel input
      const inputVelocity = wheelDelta * SPRING_TWEAKS.velocityMultiplier;
      const config = currentConfigRef.current;
      springStateRef.current.velocity += inputVelocity * config.momentum;

      // Start or continue spring animation
      startSpringAnimation();
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
  }, [startSpringAnimation]);

  // Debug mode effect
  useEffect(() => {
    if (!debugMode) return;

    const debugElement = document.createElement("div");
    debugElement.id = "spring-debug";
    debugElement.style.cssText = `
      position: fixed;
      top: 10px;
      right: 10px;
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
      const state = springStateRef.current;
      const config = currentConfigRef.current;
      const activeSection = getActiveSection(state.position);

      debugElement.innerHTML = `
        <div><strong>Spring Debug</strong></div>
        <div>Position: ${state.position.toFixed(3)}</div>
        <div>Velocity: ${state.velocity.toFixed(3)}</div>
        <div>Target: ${state.target.toFixed(3)}</div>
        <div>Section: ${Object.keys(SPRING_CONFIGS).find((key) => SPRING_CONFIGS[key] === activeSection)}</div>
        <div>Tension: ${config.tension.toFixed(1)}</div>
        <div>Friction: ${config.friction.toFixed(1)}</div>
        <div>Mass: ${config.mass.toFixed(1)}</div>
        <div>Overshoot: ${config.allowOvershoot ? "Yes" : "No"}</div>
      `;

      requestAnimationFrame(updateDebug);
    };

    updateDebug();

    return () => {
      document.body.removeChild(debugElement);
    };
  }, [debugMode, getActiveSection]);
};
