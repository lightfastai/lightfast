import type { NextConfig } from "next";

import "./src/env";

const nextConfig: NextConfig = {
  reactStrictMode: true,

  /** Enables hot reloading for local packages without a build step */
  transpilePackages: ["@repo/ui", "@vendor/inngest", "@vendor/ai"],

  experimental: {
    optimizeCss: true,
    optimizePackageImports: ["@repo/ui", "lucide-react"],
  },
};

export default nextConfig;
