import type { Source } from "nosecone";
import type { PartialCspDirectives } from "./types";

/**
 * Create CSP directives for Next.js specific requirements
 *
 * IMPORTANT: This REPLACES the default scriptSrc entirely (doesn't merge with nonces).
 *
 * We have to use unsafe-inline because some integrations don't support nonces:
 * - Vercel Analytics: https://github.com/vercel/analytics/issues/122
 * - next-themes: https://github.com/pacocoursey/next-themes/issues/106
 *
 * Per CSP spec: when 'unsafe-inline' is present alongside nonces, browsers ignore
 * 'unsafe-inline' (CSP Level 2+). This means we MUST use 'unsafe-inline' WITHOUT nonces
 * for Vercel Analytics to work.
 *
 * This matches next-forge's proven approach: replace scriptSrc entirely rather than merge.
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
    // Scripts: REPLACES default scriptSrc (removes nonce)
    // Must include 'self' and 'unsafe-inline' for Next.js + Vercel Analytics
    scriptSrc: [
      "'self'" as Source,
      "'unsafe-inline'" as Source,
    ],
  };
}
