import { NextConfig } from "next";

import "~/env";

import { withSentry } from "@vendor/next/next-config-builder";

let config: NextConfig = {
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
  ],

  /** We already do linting and typechecking as separate tasks in CI */
  // eslint: { ignoreDuringBuilds: true },
  // typescript: { ignoreBuildErrors: true },

  rewrites: async () => [
    {
      source: "/health",
      destination: "/api/health",
    },
    {
      source: "/healthz",
      destination: "/api/health",
    },
  ],
};

if (process.env.VERCEL) {
  config = withSentry(config);
}
