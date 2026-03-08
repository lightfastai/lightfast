import { withMicrofrontends } from "@vercel/microfrontends/next/config";
import type { NextConfig } from "next";

import "~/env";

import { mergeNextConfig } from "@vendor/next/merge-config";
import {
  config as vendorConfig,
  withAnalyzer,
  withBetterStack,
  withSentry,
} from "@vendor/next/next-config-builder";

import { env } from "~/env";

/**
 * Type-safe config for Next.js 16.
 *
 * The vendor functions are typed with Next.js 15's NextConfig, so we cast
 * at the boundary where we call them. The final config is properly typed
 * with Next.js 16's NextConfig.
 */
const wwwConfig: NextConfig = {
  // Next.js 16 requires explicit quality values
  images: {
    qualities: [10, 75, 100],
  },

  /** Enables hot reloading for local packages without a build step */
  transpilePackages: [
    "@repo/og",
    "@repo/ui",
    "@vendor/seo",
    "@vendor/security",
    "@vendor/analytics",
    "@vendor/email",
    "@vendor/inngest",
    "@vendor/observability",
    "@vendor/next",
    "@vendor/upstash",
    "@vendor/cms",
  ],

  // Add automatic static optimization where possible
  experimental: {
    optimizePackageImports: [
      "react-confetti",
      "framer-motion",
      "date-fns",
      "class-variance-authority",
      // lucide-react ships hundreds of icons — optimizePackageImports
      // makes the compiler only bundle the specific icons imported rather
      // than the full barrel, eliminating dead icon code from every chunk.
      "lucide-react",
    ],
  },

  // Note: /docs routing is handled by @vercel/microfrontends via
  // apps/console/microfrontends.json. No manual rewrites needed.
};

// Build config using vendor utilities (cast at Next.js 15/16 boundary)
let config = withBetterStack(
  mergeNextConfig(
    vendorConfig,
    wwwConfig as Parameters<typeof mergeNextConfig>[1]
  )
) as NextConfig;

if (env.VERCEL) {
  config = withSentry(config as Parameters<typeof withSentry>[0]) as NextConfig;
}

// Enable bundle analysis when requested
if (process.env.ANALYZE === "true") {
  config = withAnalyzer(
    config as Parameters<typeof withAnalyzer>[0]
  ) as NextConfig;
}

export default withMicrofrontends(config, { debug: true });
