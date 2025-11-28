import type { PartialCspDirectives } from "./types";

/**
 * Create CSP directives for Vercel Analytics and Speed Insights
 *
 * Required domains:
 * - va.vercel-scripts.com: Analytics and Speed Insights scripts
 * - vitals.vercel-insights.com: Performance metrics endpoint
 *
 * @returns Partial CSP directives for Vercel Analytics
 *
 * @example
 * ```ts
 * const options = composeCspOptions(
 *   createAnalyticsCspDirectives(),
 *   // ... other CSP configs
 * );
 * ```
 */
export function createAnalyticsCspDirectives(): PartialCspDirectives {
  return {
    // Scripts: Vercel Analytics and Speed Insights
    scriptSrc: [
      "https://va.vercel-scripts.com",
    ],

    // Connections: Performance vitals endpoint
    connectSrc: [
      "https://vitals.vercel-insights.com",
    ],
  };
}
