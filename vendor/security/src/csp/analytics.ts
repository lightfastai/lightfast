import type { PartialCspDirectives } from "./types";

/**
 * Create CSP directives for Vercel Analytics, Speed Insights, and PostHog
 *
 * Required domains:
 * - va.vercel-scripts.com: Analytics and Speed Insights scripts
 * - vitals.vercel-insights.com: Performance metrics endpoint
 * - us.i.posthog.com: PostHog analytics endpoint
 * - *.posthog.com: PostHog CDN for scripts
 *
 * @returns Partial CSP directives for Analytics (Vercel + PostHog)
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
    // Scripts: Vercel Analytics and PostHog
    scriptSrc: [
      "https://va.vercel-scripts.com",
      "https://us-assets.i.posthog.com",
    ],

    // Connections: Performance vitals and PostHog endpoints
    connectSrc: [
      "https://vitals.vercel-insights.com",
      "https://us.i.posthog.com",
      "https://*.ingest.us.sentry.io",
    ],
  };
}
