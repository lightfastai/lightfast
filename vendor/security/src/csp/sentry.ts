import type { PartialCspDirectives } from "./types";

/**
 * Create CSP directives for Sentry error reporting
 *
 * Allows connections to Sentry's ingest endpoints across all regions
 * Uses wildcard to support different Sentry organizations and regions:
 * - *.ingest.sentry.io (US region)
 * - *.ingest.us.sentry.io (US region, explicit)
 * - *.ingest.eu.sentry.io (EU region)
 * - *.ingest.de.sentry.io (German region)
 *
 * @returns Partial CSP directives for Sentry integration
 *
 * @example
 * ```ts
 * const options = composeCspOptions(
 *   createSentryCspDirectives(),
 *   // ... other CSP configs
 * );
 * ```
 */
export function createSentryCspDirectives(): PartialCspDirectives {
  return {
    // Connections: Sentry error reporting endpoints
    connectSrc: [
      "https://*.ingest.sentry.io",
      "https://*.ingest.us.sentry.io",
    ],
  };
}
