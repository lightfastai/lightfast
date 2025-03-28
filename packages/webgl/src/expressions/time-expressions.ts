/**
 * TimeExpressions - A module for handling time-based expressions in WebGL shaders
 *
 * This provides a more structured approach to time-based animations in shaders,
 * allowing for complex expressions and time manipulations.
 */

import type { TimeContext } from "./types";

/**
 * Creates a time context object with current time values
 * @param elapsedTime Total elapsed time in seconds
 * @param deltaTime Time since last frame in seconds
 * @param frameCount Current frame number
 * @returns TimeContext object
 */
export function createTimeContext(
  elapsedTime: number,
  deltaTime: number,
  frameCount = 0,
  fps = 60,
): TimeContext {
  // Get current time
  const now = new Date();

  return {
    time: elapsedTime,
    delta: deltaTime,

    me: {
      time: {
        now: elapsedTime,
        delta: deltaTime,
        elapsed: elapsedTime,

        frame: frameCount,
        fps: fps,

        seconds: now.getSeconds() + now.getMilliseconds() / 1000,
        minutes: now.getMinutes(),
        hours: now.getHours(),
      },
    },
  };
}

/**
 * Evaluates a time expression using the provided context
 * @param expression Time expression string
 * @param context Time context object
 * @returns Evaluated numeric result
 */
export function evaluateTimeExpression(
  expression: string,
  context: TimeContext,
): number {
  try {
    // Create a safe evaluation environment with only the context variables
    // Convert the context to a flat object for easier variable substitution
    const flatContext = flattenContext(context);

    // Build a function with all context variables as parameters
    const paramNames = Object.keys(flatContext);
    const paramValues = Object.values(flatContext);

    // Create a function that evaluates the expression with the context
    const evaluator = new Function(...paramNames, `return ${expression};`);

    // Execute the function with the context values
    return evaluator(...paramValues);
  } catch (error) {
    console.error(`Error evaluating time expression: "${expression}"`, error);
    // Return a default safe value
    return context.time * 0.1;
  }
}

/**
 * Flattens a nested context object into a single-level object
 * This makes it easier to use in expression evaluation
 *
 * @param context The nested context object
 * @param prefix Prefix for nested keys
 * @returns Flattened object with dot notation keys
 */
function flattenContext(
  context: Record<string, any>,
  prefix = "",
): Record<string, any> {
  return Object.entries(context).reduce(
    (acc, [key, value]) => {
      const newKey = prefix ? `${prefix}.${key}` : key;

      if (value && typeof value === "object" && !Array.isArray(value)) {
        // Recursively flatten nested objects
        Object.assign(acc, flattenContext(value, newKey));
      } else {
        // Add leaf values to the result
        acc[newKey] = value;
      }

      return acc;
    },
    {} as Record<string, any>,
  );
}

/**
 * Creates a safe version of a time expression
 * This sanitizes the input to prevent injection attacks
 *
 * @param expression Raw time expression
 * @returns Sanitized expression
 */
export function sanitizeTimeExpression(expression: string): string {
  // Remove potentially harmful constructs
  // This is a basic implementation and could be expanded
  return expression
    .replace(/[;{}]/g, "") // Remove semicolons and braces
    .replace(/\b(eval|Function|setTimeout|setInterval)\b/g, ""); // Remove unsafe functions
}

/**
 * Pre-compiles a time expression for repeated efficient evaluation
 * Returns a function that can be called with a context
 *
 * @param expression Time expression to compile
 * @returns Function that evaluates the expression with a given context
 */
export function compileTimeExpression(
  expression: string,
): (context: TimeContext) => number {
  // Sanitize the expression
  const safeExpression = sanitizeTimeExpression(expression);

  // Create a compiled function that can be called multiple times
  return (context: TimeContext): number => {
    return evaluateTimeExpression(safeExpression, context);
  };
}
