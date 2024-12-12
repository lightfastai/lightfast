import { withLogtail as withLogtailNext } from "@logtail/next";
import withBundleAnalyzer from "@next/bundle-analyzer";
import { withSentryConfig } from "@sentry/nextjs";
import withVercelToolbar from "@vercel/toolbar/plugins/next";
import { createSecureHeaders } from "next-secure-headers";

/** @type {import("next").NextConfig} */
export const config = withVercelToolbar()({
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "fal.media",
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
    ];
  },

  async headers() {
    return [
      {
        source: "/(.*)",
        headers: createSecureHeaders({
          // HSTS Preload: https://hstspreload.org/
          forceHTTPSRedirect: [
            true,
            { maxAge: 63_072_000, includeSubDomains: true, preload: true },
          ],
        }),
      },
    ];
  },

  webpack(config, { isServer }) {
    if (isServer) {
      config.plugins = [...config.plugins];
    }

    config.ignoreWarnings = [{ module: /@opentelemetry\/instrumentation/ }];

    // Add support for GLSL shaders @note used by dahlia. requires rework...
    config.module.rules.push({
      test: /\.(vert|frag)$/,
      use: "webpack-glsl-loader",
    });

    // Add fallbacks for node modules. @note this is required for tree-sitter. requires rework...
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      path: false,
    };

    // Add WASM support. @note this is required for tree-sitter. requires rework...
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
    };

    return config;
  },

  // This is required to support PostHog trailing slash API requests
  skipTrailingSlashRedirect: true,
});

/** @type {Parameters<typeof withSentryConfig>[1]} */
export const sentryConfig = {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,

  // Only print logs for uploading source maps in CI
  silent: !process.env.CI,

  // Only widen client file upload in production on Vercel
  widenClientFileUpload: process.env.VERCEL_ENV === "production",

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

  // Hides source maps from generated client bundles
  hideSourceMaps: true,

  // Automatically tree-shake Sentry logger statements to reduce bundle size
  disableLogger: true,

  /*
   * Enables automatic instrumentation of Vercel Cron Monitors. (Does not yet work with App Router route handlers.)
   * See the following for more information:
   * https://docs.sentry.io/product/crons/
   * https://vercel.com/docs/cron-jobs
   */
  automaticVercelMonitors: true,
};

/**
 * @type {(sourceConfig: import("next").NextConfig) => import("next").NextConfig}
 * @returns {import("next").NextConfig}
 */
export const withSentry = (sourceConfig) =>
  withSentryConfig(sourceConfig, sentryConfig);

/**
 * @type {(sourceConfig: import("next").NextConfig) => import("next").NextConfig}
 * @returns {import("next").NextConfig}
 */
export const withAnalyzer = (sourceConfig) =>
  withBundleAnalyzer()(sourceConfig);

/**
 * @type {(sourceConfig: import("next").NextConfig) => import("next").NextConfig}
 * @returns {import("next").NextConfig}
 */
export const withLogtail = (sourceConfig) => withLogtailNext(sourceConfig);
