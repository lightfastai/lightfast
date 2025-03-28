/**
 * Type definitions for the expressions system
 */

/**
 * Context object for time expressions
 * Contains time-related variables and helper functions
 */
export interface TimeContext {
  // Basic time values
  time: number; // Current elapsed time (in seconds)
  delta: number; // Time since last frame (in seconds)

  // Time namespace - organized access to time variables
  me: {
    time: {
      now: number; // Alias for time
      delta: number; // Alias for delta
      elapsed: number; // Alias for time (total elapsed time)

      // Additional time helpers
      frame: number; // Current frame number
      fps: number; // Current frames per second

      // Time modifiers
      seconds: number; // Current seconds value (0-59)
      minutes: number; // Current minutes value (0-59)
      hours: number; // Current hours value (0-23)
    };
  };
}
