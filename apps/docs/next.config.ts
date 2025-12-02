import { createMDX } from "fumadocs-mdx/next";
import type { NextConfig } from "next/types";

import "./src/env";

const withMDX = createMDX();

const config: NextConfig = {
  reactStrictMode: true,

  images: {
    formats: ["image/webp"],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "imagedelivery.net",
      },
    ],
  },

  /** Enables hot reloading for local packages without a build step */
  transpilePackages: ["@repo/ui", "@repo/url-utils", "@vendor/seo"],

  /** Asset prefix for serving through console app rewrites (/docs path) */
  assetPrefix: "/docs",
};

export default withMDX(config);
