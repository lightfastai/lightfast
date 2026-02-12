import type { PartialCspDirectives } from "./types";

/**
 * Create CSP directives for Vercel Analytics, Speed Insights, and PostHog
 *
 * Required domains:
 * - va.vercel-scripts.com: Analytics and Speed Insights scripts
 * - vitals.vercel-insights.com: Performance metrics endpoint
 * - us.i.posthog.com: PostHog analytics endpoint (direct)
 * - us.posthog.com: PostHog UI host (for feature flags, surveys, etc.)
 * - us-assets.i.posthog.com: PostHog script CDN
 *
 * Note: PostHog reverse proxy (/ingest) uses same-origin requests via Next.js
 * rewrites, so no additional CSP domains needed for the proxy.
 * Note: Sentry CSP directives are in sentry.ts, not here.
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
    // Scripts: Vercel Analytics and PostHog CDN (proxy is same-origin)
    scriptSrc: [
      "https://va.vercel-scripts.com",
      "https://us-assets.i.posthog.com",
    ],

    // Connections: Performance vitals and PostHog direct/UI
    connectSrc: [
      "https://vitals.vercel-insights.com",
      "https://us.i.posthog.com",
      "https://us.posthog.com",
    ],

    // Frames: PostHog surveys and feature flag UI
    frameSrc: ["https://us.posthog.com"],
  };
}
