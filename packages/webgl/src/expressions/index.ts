/**
 * Expression system for WebGL animations
 * Provides a way to create and evaluate expressions, particularly for time-based animations
 */

// Re-export everything from time-expressions except TimeContext
// (which is already defined in types.ts)
export {
  createTimeContext,
  evaluateTimeExpression,
  sanitizeTimeExpression,
  compileTimeExpression,
} from "./time-expressions";

// Export types
export * from "./types";
