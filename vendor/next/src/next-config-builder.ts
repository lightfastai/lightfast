import { NextConfig } from "next";
import { withBetterStack as withBetterStackNext } from "@logtail/next";
import withBundleAnalyzer from "@next/bundle-analyzer";
import { withSentryConfig } from "@sentry/nextjs";
import withVercelToolbar from "@vercel/toolbar/plugins/next";
import { createSecureHeaders } from "next-secure-headers";

import { env } from "../env";

export const config: NextConfig = withVercelToolbar()({
  serverExternalPackages: ["import-in-the-middle", "require-in-the-middle"],

  images: {
    formats: ["image/webp"],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "imagedelivery.net",
      },
      {
        protocol: "https",
        hostname: "assets.basehub.com",
      },
    ],
  },

  async rewrites() {
    return [
      {
        source: "/ingest/static/:path*",
        destination: "https://us-assets.i.posthog.com/static/:path*",
      },
      {
        source: "/ingest/:path*",
        destination: "https://us.i.posthog.com/:path*",
      },
      {
        source: "/ingest/decide",
        destination: "https://us.i.posthog.com/decide",
      },
      {
        source: "/health",
        destination: "/api/health",
      },
      {
        source: "/healthz",
        destination: "/api/health",
      },
    ];
  },

  async headers() {
    const securityHeaders = createSecureHeaders({
      // HSTS Preload: https://hstspreload.org/
      forceHTTPSRedirect: [
        true,
        { maxAge: 63_072_000, includeSubDomains: true, preload: true },
      ],
    });

    return [
      {
        source: "/(.*)",
        headers: [
          ...securityHeaders,
          { key: "Document-Policy", value: "js-profiling" },
        ],
      },
    ];
  },

  // This is required to support PostHog trailing slash API requests
  skipTrailingSlashRedirect: true,
});

export const sentryConfig: Parameters<typeof withSentryConfig>[1] = {
  org: env.SENTRY_ORG,
  project: env.SENTRY_PROJECT,
  authToken: env.SENTRY_AUTH_TOKEN,

  // Only print logs for uploading source maps in CI
  silent: !env.CI,

  // Only widen client file upload in production on Vercel
  widenClientFileUpload: env.VERCEL_ENV === "production",

  /*
   * For all available options, see:
   * https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/
   */

  // Automatically annotate React components to show their full name in breadcrumbs and session replay
  reactComponentAnnotation: {
    enabled: true,
  },

  /*
   * Route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
   * This can increase your server load as well as your hosting bill.
   * Note: Check that the configured route will not match with your Next.js middleware, otherwise reporting of client-
   * side errors will fail.
   */
  tunnelRoute: "/monitoring",

  // Automatically tree-shake Sentry logger statements to reduce bundle size
  disableLogger: true,

  bundleSizeOptimizations: {
    excludeDebugStatements: true,
  },

  /*
   * Enables automatic instrumentation of Vercel Cron Monitors. (Does not yet work with App Router route handlers.)
   * See the following for more information:
   * https://docs.sentry.io/product/crons/
   * https://vercel.com/docs/cron-jobs
   */
  automaticVercelMonitors: true,
};

export const withSentry: (sourceConfig: NextConfig) => NextConfig = (
  sourceConfig: NextConfig,
) => withSentryConfig(sourceConfig, sentryConfig);

/**
 * @type {(sourceConfig: import("next").NextConfig) => import("next").NextConfig}
 * @returns {import("next").NextConfig}
 */
export const withAnalyzer: (sourceConfig: NextConfig) => NextConfig = (
  sourceConfig: NextConfig,
) => withBundleAnalyzer()(sourceConfig);

/**
 * @type {(sourceConfig: import("next").NextConfig) => import("next").NextConfig}
 * @returns {import("next").NextConfig}
 */
export const withBetterStack: (sourceConfig: NextConfig) => NextConfig = (
  sourceConfig: NextConfig,
) => withBetterStackNext(sourceConfig);
