import type { NextConfig } from "next/types";
import { withMicrofrontends } from "@vercel/microfrontends/next/config";

import "~/env";

const config: NextConfig = {
  reactStrictMode: true,

  images: {
    formats: ["image/avif", "image/webp"],
  },

  /** Enables hot reloading for local packages without a build step */
  transpilePackages: [
    "@repo/ui",
    "@repo/site-config",
    "@vendor/seo",
    "@vendor/clerk",
    "@vendor/security",
    "@vendor/upstash",
  ],

  /** We already do linting and typechecking as separate tasks in CI */
  // eslint: { ignoreDuringBuilds: true },
  // typescript: { ignoreBuildErrors: true },

  // Add automatic static optimization where possible
  experimental: {
    // For Next.js 15.3+
    optimizeCss: true,
    optimizePackageImports: ["@repo/ui", "lucide-react"],
  },
};

// Use withMicrofrontends (www will start the proxy automatically)
export default withMicrofrontends(config, { debug: true });
