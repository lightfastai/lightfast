import "~/env";

import { NextConfig } from "next";

let config: NextConfig = {
  reactStrictMode: true,

  /** Enables hot reloading for local packages without a build step */
  transpilePackages: [
    "@repo/ai",
    "@dahlia/trpc",
    "@repo/lib",
    "@repo/ui",
    "@repo/webgl",
    "@vendor/clerk",
    "@vendor/db",
    "@vendor/trpc",
  ],

  experimental: {
    optimizeCss: true,
    optimizePackageImports: [
      "@repo/ui",
      "jotai",
      "lucide-react",
      "react-confetti",
    ],
  },

  /** We already do linting and typechecking as separate tasks in CI */
  // eslint: { ignoreDuringBuilds: true },
  // typescript: { ignoreBuildErrors: true },

  /** Shared next config */
};

export default config;
