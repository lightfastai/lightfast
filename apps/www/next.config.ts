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
import { localAllowedDevOrigins } from "~/local-dev-origins";

const localDevUrls = [env.NEXT_PUBLIC_APP_URL, env.NEXT_PUBLIC_WWW_URL];

const wwwConfig: NextConfig = merge({}, baseConfig, {
  allowedDevOrigins: localAllowedDevOrigins(localDevUrls),

  async redirects() {
    return [
      {
        source: "/v2/legal/terms-of-service",
        destination: "/legal/terms",
        permanent: true,
      },
      {
        source: "/v2/legal/privacy-policy",
        destination: "/legal/privacy",
        permanent: true,
      },
      {
        source: "/v2",
        destination: "/",
        permanent: true,
      },
      {
        source: "/v2/:path*",
        destination: "/:path*",
        permanent: true,
      },
      {
        source: "/company",
        destination: "/brand",
        permanent: false,
      },
      {
        source: "/company/:path*",
        destination: "/brand",
        permanent: false,
      },
      {
        source: "/pricing",
        destination: "/",
        permanent: false,
      },
      {
        source: "/use-cases/:path*",
        destination: "/",
        permanent: false,
      },
      {
        source: "/careers",
        destination: "/brand",
        permanent: false,
      },
      {
        source: "/careers/:path*",
        destination: "/brand",
        permanent: false,
      },
      {
        source: "/blog/rss.xml",
        destination: "/blog",
        permanent: false,
      },
      {
        source: "/blog/atom.xml",
        destination: "/blog",
        permanent: false,
      },
      {
        source: "/blog/feed.xml",
        destination: "/blog",
        permanent: false,
      },
      {
        source: "/blog/topic/:path*",
        destination: "/blog",
        permanent: false,
      },
      {
        source: "/search",
        destination: "/blog",
        permanent: false,
      },
      {
        source: "/pitch-deck",
        destination: "/",
        permanent: false,
      },
    ];
  },

  images: {
    qualities: [10, 75, 100],
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
