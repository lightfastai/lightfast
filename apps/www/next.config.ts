import { NextConfig } from "next";

import "~/env";

import {
  config as vendorConfig,
  withBetterStack,
  withSentry,
} from "@vendor/next/next-config-builder";

import { env } from "~/env";

let config: NextConfig = withBetterStack({
  reactStrictMode: true,

  /** Enables hot reloading for local packages without a build step */
  transpilePackages: [
    "@repo/ui",
    "@vendor/security",
    "@vendor/analytics",
    "@vendor/email",
    "@vendor/clerk",
    "@vendor/inngest",
    "@vendor/observability",
    "@vendor/next",
    "@vendor/upstash",
    "@repo/lightfast-config",
    "@repo/lightfast-email",
    "@repo/lib",
  ],

  /** We already do linting and typechecking as separate tasks in CI */
  // eslint: { ignoreDuringBuilds: true },
  // typescript: { ignoreBuildErrors: true },

  // Add automatic static optimization where possible
  experimental: {
    // For Next.js 15.3+
    optimizeCss: true,
    optimizePackageImports: [
      "@repo/ui",
      "jotai",
      "lucide-react",
      "react-confetti",
    ],
    // Faster navigation for production
    // ppr: true,
  },

  ...vendorConfig,
});

if (env.VERCEL) {
  config = withSentry(config);
}

export default config;
