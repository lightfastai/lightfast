import { NextConfig } from "next";
import { withMicrofrontends } from "@vercel/microfrontends/next/config";

import "./src/env";

import {
  config as vendorConfig,
  withBetterStack,
} from "@vendor/next/next-config-builder";
import { mergeNextConfig } from "@vendor/next/merge-config";

const config: NextConfig = withBetterStack(
  mergeNextConfig(vendorConfig, {
    reactStrictMode: true,
    transpilePackages: [
      "@repo/ui",
      "@repo/site-config",
      "@vendor/seo",
      "@vendor/observability",
      "@vendor/next",
    ],
    experimental: {
      optimizeCss: true,
      optimizePackageImports: ["@repo/ui", "lucide-react"],
      turbopackScopeHoisting: false,
    },
    async rewrites() {
      return [];
    },
  }),
);

export default withMicrofrontends(config, { debug: true });
