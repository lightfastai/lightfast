import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from "next";
import { createSecureHeaders } from "next-secure-headers";

import { env } from "./env";

/**
 * Shared base Next.js config applied to all apps via lodash.merge.
 *
 * Wrappers (Sentry, BetterStack, Toolbar, Analyzer) are applied
 * directly in each app's next.config.ts — not hidden behind helpers.
 */
export const baseConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,

  // React Compiler and optimizeCss add significant overhead in local dev.
  // Only enable on Vercel where builds are one-shot.
  reactCompiler: !!env.VERCEL,

  compiler: {
    removeConsole:
      process.env.NODE_ENV === "production"
        ? { exclude: ["error", "warn"] }
        : false,
  },

  images: {
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 31_536_000,
    remotePatterns: [
      { protocol: "https", hostname: "imagedelivery.net" },
      { protocol: "https", hostname: "assets.basehub.com" },
      { protocol: "https", hostname: "avatars.githubusercontent.com" },
    ],
  },

  rewrites() {
    return Promise.resolve([
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
      { source: "/health", destination: "/api/health" },
      { source: "/healthz", destination: "/api/health" },
    ]);
  },

  headers() {
    const securityHeaders = createSecureHeaders({
      forceHTTPSRedirect: [
        true,
        { maxAge: 63_072_000, includeSubDomains: true, preload: true },
      ],
    });

    return Promise.resolve([
      {
        source: "/(.*)",
        headers: [
          ...securityHeaders,
          { key: "Document-Policy", value: "js-profiling" },
        ],
      },
    ]);
  },

  experimental: {
    optimizeCss: !!env.VERCEL,
    staleTimes: { dynamic: 30, static: 180 },
    optimizePackageImports: [
      "@repo/ui",
      "lucide-react",
      "shiki",
      "recharts",
      "@tanstack/react-table",
      "@tanstack/table-core",
    ],
  },

  // Required to support PostHog trailing slash API requests
  skipTrailingSlashRedirect: true,
};

/**
 * Shared Sentry plugin options. Use with withSentryConfig(config, sentryOptions).
 */
export const sentryOptions: Parameters<typeof withSentryConfig>[1] = {
  org: env.SENTRY_ORG,
  project: env.SENTRY_PROJECT,
  authToken: env.SENTRY_AUTH_TOKEN,
  silent: !env.CI,
  widenClientFileUpload: env.VERCEL_ENV === "production",
  reactComponentAnnotation: { enabled: false },
  tunnelRoute: "/monitoring",
  disableLogger: true,
  bundleSizeOptimizations: { excludeDebugStatements: true },
  automaticVercelMonitors: false,
};
