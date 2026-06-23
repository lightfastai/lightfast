import { withBetterStack } from "@logtail/next";
import withBundleAnalyzer from "@next/bundle-analyzer";
import { withSentryConfig } from "@sentry/nextjs";
import { baseConfig, sentryOptions } from "@vendor/next/config";
import { withMicrofrontends } from "@vercel/microfrontends/next/config";
import withVercelToolbar from "@vercel/toolbar/plugins/next";
import { createMDX } from "fumadocs-mdx/next";
import merge from "lodash.merge";
import type { NextConfig } from "next";

import { env } from "~/env";

const wwwConfig: NextConfig = merge({}, baseConfig, {
  // Next only allows `localhost` and one-level `*.localhost` dev origins by
  // default. Portless worktree hosts are nested under lightfast.localhost.
  allowedDevOrigins: ["lightfast.localhost", "**.lightfast.localhost"],

  async redirects() {
    return [
      {
        source: "/company",
        destination: "/brand",
        permanent: true,
      },
      {
        source: "/company/:path*",
        destination: "/brand",
        permanent: true,
      },
      {
        source: "/legal",
        destination: "/legal/terms",
        permanent: true,
      },
    ];
  },

  images: {
    qualities: [10, 40, 75, 100],
  },

  transpilePackages: [
    "@repo/ui",
    "@vendor/aeo",
    "@vendor/analytics",
    "@vendor/inngest",
    "@vendor/next",
    "@vendor/observability",
    "@vendor/resend",
    "@vendor/security",
    "@vendor/seo",
  ],

  typedRoutes: true,

  experimental: {
    optimizePackageImports: [
      "@hugeicons/core-free-icons",
      "@hugeicons/react",
      "date-fns",
      "class-variance-authority",
    ],
  },
} satisfies NextConfig);

let config: NextConfig = withBetterStack(withVercelToolbar()(wwwConfig));

if (env.VERCEL) {
  config = withSentryConfig(config, sentryOptions) as NextConfig;
}

if (process.env.ANALYZE === "true") {
  config = withBundleAnalyzer()(config) as NextConfig;
}

const withMDX = createMDX({
  configPath: "source.config.ts",
});

export default withMicrofrontends(withMDX(config), {
  configPath: "../app/microfrontends.json",
  debug: process.env.NODE_ENV === "development",
});
