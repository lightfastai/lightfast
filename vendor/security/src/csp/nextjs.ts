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
 * We use unsafe-eval in both dev and prod because:
 * - Development: Required by Turbopack for hot module replacement
 * - Production: Required by PostHog for feature flags and dynamic configuration
 *   OR Vercel Analytics for performance tracking
 *
 * TODO: Investigate exact source of eval usage and consider alternatives:
 * - PostHog: Check if advanced feature flag evaluation can be disabled
 * - Vercel Analytics: Review if eval can be avoided with configuration changes
 * - Add CSP reporting endpoint to capture violation details
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
    "'unsafe-eval'" as Source, // Required by Turbopack (dev) and PostHog/Vercel Analytics (prod)
  ];

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
