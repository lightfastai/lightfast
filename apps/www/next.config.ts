import type { NextConfig } from "next";

import { withBetterStack, withSentry } from "@vendor/next/next-config-builder";

import { env } from "~/env";

const otelRegex = /@opentelemetry\/instrumentation/;

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
  ],

  /** We already do linting and typechecking as separate tasks in CI */
  // eslint: { ignoreDuringBuilds: true },
  // typescript: { ignoreBuildErrors: true },
  rewrites: async () => ({
    beforeFiles: [
      {
        source: "/health",
        destination: "/api/health",
      },
      {
        source: "/healthz",
        destination: "/api/health",
      },
    ],
  }),

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
    ppr: true,
    useCache: true,
    reactCompiler: true,
  },

  webpack(config) {
    config.ignoreWarnings = [{ module: otelRegex }];
    return config;
  },
});

if (env.VERCEL) {
  config = withSentry(config);
}

export default config;
