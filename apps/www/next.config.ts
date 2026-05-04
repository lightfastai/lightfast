import { withPortlessMfeDev } from "@lightfastai/dev-proxy/next";
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
  images: {
    qualities: [10, 75, 100],
  },

  async redirects() {
    return [
      {
        source: "/docs",
        destination: "/docs/get-started/overview",
        permanent: true,
      },
      {
        source: "/docs/api",
        destination: "/docs/api-reference/getting-started/overview",
        permanent: true,
      },
      {
        source: "/docs/api-reference",
        destination: "/docs/api-reference/getting-started/overview",
        permanent: true,
      },
      {
        source: "/docs/get-started",
        destination: "/docs/get-started/overview",
        permanent: true,
      },
      {
        source: "/docs/connectors",
        destination: "/docs/connectors/github",
        permanent: true,
      },
      {
        source: "/docs/integrate",
        destination: "/docs/integrate/sdk",
        permanent: true,
      },
      {
        source: "/docs/api-reference/getting-started",
        destination: "/docs/api-reference/getting-started/overview",
        permanent: true,
      },
      {
        source: "/docs/api-reference/sdks-tools",
        destination: "/docs/api-reference/sdks-tools/typescript-sdk",
        permanent: true,
      },
    ];
  },

  transpilePackages: [
    "@repo/og",
    "@repo/ui",
    "@vendor/aeo",
    "@vendor/analytics",
    "@vendor/email",
    "@vendor/inngest",
    "@vendor/next",
    "@vendor/observability",
    "@vendor/security",
    "@vendor/seo",
  ],

  typedRoutes: true,

  experimental: {
    optimizePackageImports: [
      "framer-motion",
      "date-fns",
      "class-variance-authority",
      "lucide-react",
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

export default withPortlessMfeDev(
  withMicrofrontends(withMDX(config), {
    debug: process.env.NODE_ENV === "development",
  })
);
