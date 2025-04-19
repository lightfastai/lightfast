import { NextConfig } from "next";

import "~/env";

/** @type {import("next").NextConfig} */
const config: NextConfig = {
  reactStrictMode: true,

  /** Enables hot reloading for local packages without a build step */
  transpilePackages: [
    "@repo/ui",
    "@vendor/security",
    "@vendor/analytics",
    "@vendor/email",
    "@vendor/clerk",
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

export default config;
