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
