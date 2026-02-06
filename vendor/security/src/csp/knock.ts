import type { PartialCspDirectives } from "./types";

/**
 * Create CSP directives for Knock notifications
 *
 * Includes:
 * - Knock API for in-app feed notifications
 * - WebSocket connections for real-time updates
 *
 * @returns Partial CSP directives for Knock integration
 *
 * @example
 * ```ts
 * const options = composeCspOptions(
 *   createKnockCspDirectives(),
 *   // ... other CSP configs
 * );
 * ```
 */
export function createKnockCspDirectives(): PartialCspDirectives {
  return {
    // Connections: Knock API and WebSocket for real-time notifications
    connectSrc: [
      "https://api.knock.app",
      "wss://api.knock.app",
    ],

    // Scripts: Knock components (if needed)
    scriptSrc: [
      "https://cdn.knock.app",
    ],
  };
}
