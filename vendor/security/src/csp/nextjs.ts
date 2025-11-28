import type { Source } from "nosecone";
import type { PartialCspDirectives } from "./types";

/**
 * Create CSP directives for Next.js specific requirements
 *
 * We have to use unsafe-inline because some integrations don't support nonces:
 * - Vercel Analytics: https://github.com/vercel/analytics/issues/122
 * - next-themes: https://github.com/pacocoursey/next-themes/issues/106
 *
 * This is a known limitation of these libraries, not a security oversight.
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
    // Scripts: Allow inline scripts for Vercel Analytics and next-themes
    // These libraries inject inline scripts without nonce support
    scriptSrc: [
      "'unsafe-inline'" as Source,
    ],
  };
}
