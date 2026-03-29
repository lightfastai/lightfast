import { withBetterStack } from "@logtail/next";
import { withSentryConfig } from "@sentry/nextjs";
import { baseConfig, sentryOptions } from "@vendor/next/config";
import withVercelToolbar from "@vercel/toolbar/plugins/next";
import merge from "lodash.merge";
import type { NextConfig } from "next";

const platformConfig: NextConfig = merge({}, baseConfig, {
  transpilePackages: [
    "@api/platform",
    "@db/app",
    "@repo/app-providers",
    "@repo/lib",
    "@vendor/inngest",
    "@vendor/next",
    "@vendor/observability",
    "@vendor/security",
    "@vendor/upstash",
  ],
  experimental: {
    optimizePackageImports: ["@repo/lib", "@vendor/observability"],
  },
} satisfies NextConfig);

export default withSentryConfig(
  withBetterStack(withVercelToolbar()(platformConfig)),
  sentryOptions
);
