import type { Source } from "nosecone";
import type { PartialCspDirectives } from "./types";

/**
 * Create CSP directives for Next.js specific requirements
 *
 * Following next-forge pattern: these directives merge with Nosecone defaults.
 *
 * We use unsafe-inline because some integrations don't support nonces:
 * - Vercel Analytics: https://github.com/vercel/analytics/issues/122
 * - next-themes: https://github.com/pacocoursey/next-themes/issues/106
 *
 * @returns Partial CSP directives for Next.js integration
 *
 * @example
 * ```ts
 * const options = composeCspOptions(
 *   createNextjsCspDirectives(),
 *   createClerkCspDirectives(),
 *   // ... other CSP configs
 * );
 * ```
 */
export function createNextjsCspDirectives(): PartialCspDirectives {
  return {
    // Scripts: Allow self-hosted scripts and unsafe-inline for Vercel Analytics
    scriptSrc: [
      "'self'" as Source,
      "'unsafe-inline'" as Source,
    ],

    // Images: Allow self-hosted images, data URIs (for favicons), and blob URLs
    imgSrc: [
      "'self'" as Source,
      "data:" as Source,
      "blob:" as Source,
    ],

    // Connections: Allow same-origin requests (for RSC payloads, API routes, etc.)
    connectSrc: [
      "'self'" as Source,
    ],
  };
}
