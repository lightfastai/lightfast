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
        source: "/",
        destination: "/v2",
        permanent: false,
      },
      {
        source: "/blog",
        destination: "/v2/blog",
        permanent: false,
      },
      {
        source: "/brand",
        destination: "/v2/brand",
        permanent: false,
      },
      {
        source: "/company",
        destination: "/v2/brand",
        permanent: false,
      },
      {
        source: "/company/:path*",
        destination: "/v2/brand",
        permanent: false,
      },
      {
        source: "/pricing",
        destination: "/v2",
        permanent: false,
      },
      {
        source: "/use-cases/:path*",
        destination: "/v2",
        permanent: false,
      },
      {
        source: "/careers",
        destination: "/v2/brand",
        permanent: false,
      },
      {
        source: "/careers/:path*",
        destination: "/v2/brand",
        permanent: false,
      },
      {
        source: "/blog/rss.xml",
        destination: "/v2/blog",
        permanent: false,
      },
      {
        source: "/blog/atom.xml",
        destination: "/v2/blog",
        permanent: false,
      },
      {
        source: "/blog/feed.xml",
        destination: "/v2/blog",
        permanent: false,
      },
      {
        source: "/blog/topic/:path*",
        destination: "/v2/blog",
        permanent: false,
      },
      {
        source: "/blog/:path*",
        destination: "/v2/blog/:path*",
        permanent: false,
      },
      {
        source: "/v2/legal/terms-of-service",
        destination: "/v2/legal/terms",
        permanent: false,
      },
      {
        source: "/v2/legal/privacy-policy",
        destination: "/v2/legal/privacy",
        permanent: false,
      },
      {
        source: "/search",
        destination: "/v2/blog",
        permanent: false,
      },
      {
        source: "/pitch-deck",
        destination: "/v2",
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

export default withMicrofrontends(withMDX(config), {
  configPath: "../app/microfrontends.json",
  debug: process.env.NODE_ENV === "development",
});
