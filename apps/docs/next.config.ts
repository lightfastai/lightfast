import { createMDX } from "fumadocs-mdx/next";
import type { NextConfig } from "next/types";

import "./src/env";

import {
  config as vendorConfig,
  withBetterStack,
  withSentry,
} from "@vendor/next/next-config-builder";
import { mergeNextConfig } from "@vendor/next/merge-config";

import { env } from "./src/env";

const withMDX = createMDX();

let config: NextConfig = withBetterStack(
  mergeNextConfig(vendorConfig, {
    /** Enables hot reloading for local packages without a build step */
    transpilePackages: ["@repo/og", "@repo/ui", "@repo/url-utils", "@vendor/seo", "@vendor/observability", "@vendor/next"],

    /** Asset prefix for serving through console app rewrites (/docs path) */
    assetPrefix: "/docs",

    redirects: async () => [
      {
        source: "/",
        destination: "/get-started/overview",
        permanent: true,
      },
    ],

    images: {
      formats: ["image/webp"],
      remotePatterns: [
        {
          protocol: "https",
          hostname: "imagedelivery.net",
        },
      ],
    },
  }),
);

if (env.VERCEL) {
  config = withSentry(config);
}

export default withMDX(config);
