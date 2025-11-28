import type { PartialCspDirectives } from "./types";

/**
 * Create CSP directives for Vercel Analytics, Speed Insights, and PostHog
 *
 * Required domains:
 * - va.vercel-scripts.com: Analytics and Speed Insights scripts
 * - vitals.vercel-insights.com: Performance metrics endpoint
 * - us.i.posthog.com: PostHog analytics endpoint (direct)
 * - us-assets.i.posthog.com: PostHog script CDN
 * - *.vercel.app: PostHog reverse proxy (prevents ad blocking)
 * - *.ingest.sentry.io: Sentry error tracking
 *
 * @returns Partial CSP directives for Analytics (Vercel + PostHog + Sentry)
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
    // Scripts: Vercel Analytics and PostHog (direct + proxy)
    scriptSrc: [
      "https://va.vercel-scripts.com",
      "https://us-assets.i.posthog.com",
      "https://*.vercel.app", // PostHog reverse proxy
    ],

    // Connections: Performance vitals, PostHog, and Sentry
    connectSrc: [
      "https://vitals.vercel-insights.com",
      "https://us.i.posthog.com",
      "https://*.vercel.app", // PostHog reverse proxy
      "https://*.ingest.sentry.io",
      "https://*.ingest.us.sentry.io",
    ],
  };
}
