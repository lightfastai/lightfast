import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from "next";

const config: NextConfig = {
  reactStrictMode: true,

  transpilePackages: [
    // @api packages
    "@api/platform",
    // @db packages
    "@db/app",
    // @repo packages
    "@repo/app-providers",
    "@repo/lib",
    // @vendor packages
    "@vendor/inngest",
    "@vendor/observability",
    "@vendor/upstash",
  ],

  experimental: {
    optimizePackageImports: ["@repo/lib", "@vendor/observability"],
  },
};

const sentryConfig: Parameters<typeof withSentryConfig>[1] = {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
  widenClientFileUpload: false,
  disableLogger: true,
  bundleSizeOptimizations: {
    excludeDebugStatements: true,
  },
  automaticVercelMonitors: true,
};

export default withSentryConfig(config, sentryConfig);
