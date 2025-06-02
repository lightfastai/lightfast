/**
 * Pure spring physics calculations and utilities
 * Non-React specific animation math that can be reused anywhere
 */

export interface SpringConfig {
  tension: number;
  friction: number;
  mass: number;
}

export interface SpringState {
  position: number;
  velocity: number;
  target: number;
}

export const DEFAULT_SPRING_CONFIG: SpringConfig = {
  tension: 100,
  friction: 18,
  mass: 1,
} as const;

/**
 * Calculate the next spring state given current state and config
 */
export function calculateSpringStep(
  state: SpringState,
  config: SpringConfig,
  deltaTime: number,
): SpringState {
  // Spring physics calculation
  const displacement = state.target - state.position;
  const springForce = displacement * config.tension;
  const dampingForce = state.velocity * config.friction;
  const acceleration = (springForce - dampingForce) / config.mass;

  // Update velocity and position
  const newVelocity = state.velocity + acceleration * deltaTime;
  const newPosition = Math.max(
    0,
    Math.min(1, state.position + newVelocity * deltaTime),
  );

  return {
    position: newPosition,
    velocity: newVelocity,
    target: state.target,
  };
}

/**
 * Check if spring animation has settled
 */
export function isSpringSettled(
  state: SpringState,
  velocityThreshold = 0.001,
  displacementThreshold = 0.001,
): boolean {
  const displacement = state.target - state.position;
  return (
    Math.abs(state.velocity) < velocityThreshold &&
    Math.abs(displacement) < displacementThreshold
  );
}

/**
 * Clamp a value between 0 and 1
 */
export function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

/**
 * Create a new spring state
 */
export function createSpringState(
  position = 0,
  velocity = 0,
  target = 0,
): SpringState {
  return {
    position: clamp01(position),
    velocity,
    target: clamp01(target),
  };
}

/**
 * Standard easing functions that could be useful for other animations
 */
export const easing = {
  linear: (t: number): number => t,
  easeInOut: (t: number): number =>
    t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,
  easeOut: (t: number): number => t * (2 - t),
  easeIn: (t: number): number => t * t,
} as const;
