import type { Source } from "nosecone";
import type { PartialCspDirectives } from "./types";

const isDevelopment = process.env.NODE_ENV === "development";

/**
 * Create CSP directives for Next.js specific requirements
 *
 * Following next-forge pattern: these directives merge with Nosecone defaults.
 *
 * We use unsafe-inline because some integrations don't support nonces:
 * - Vercel Analytics: https://github.com/vercel/analytics/issues/122
 * - next-themes: https://github.com/pacocoursey/next-themes/issues/106
 *
 * In development, we also need:
 * - unsafe-eval: Required by Turbopack for hot module replacement
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
  const scriptSrc: Source[] = [
    "'self'" as Source,
    "'unsafe-inline'" as Source,
  ];

  // Turbopack requires unsafe-eval for HMR in development
  if (isDevelopment) {
    scriptSrc.push("'unsafe-eval'" as Source);
  }

  return {
    // Scripts: Allow self-hosted scripts and unsafe-inline for Vercel Analytics
    scriptSrc,

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
