import { createMDX } from "fumadocs-mdx/next";
import type { NextConfig } from "next/types";

import "./src/env";

import { withSentry } from "@vendor/next/next-config-builder";

import { env } from "./src/env";

const withMDX = createMDX();

let config: NextConfig = {
  reactStrictMode: true,
  reactCompiler: true,

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
  transpilePackages: ["@repo/og", "@repo/ui", "@repo/url-utils", "@vendor/seo", "@vendor/observability", "@vendor/next"],

  /** Asset prefix for serving through console app rewrites (/docs path) */
  assetPrefix: "/docs",
};

if (env.VERCEL) {
  config = withSentry(config);
}

export default withMDX(config);
