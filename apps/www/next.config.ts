import { withMicrofrontends } from "@vercel/microfrontends/next/config";
import { createMDX } from "fumadocs-mdx/next";
import type { NextConfig } from "next";

import "~/env";

import { mergeNextConfig } from "@vendor/next/merge-config";
import {
  config as vendorConfig,
  withAnalyzer,
  withBetterStack,
  withSentry,
} from "@vendor/next/next-config-builder";

import { env } from "~/env";

/**
 * Type-safe config for Next.js 16.
 *
 * The vendor functions are typed with Next.js 15's NextConfig, so we cast
 * at the boundary where we call them. The final config is properly typed
 * with Next.js 16's NextConfig.
 */
const wwwConfig: NextConfig = {
  // Next.js 16 requires explicit quality values
  images: {
    qualities: [10, 75, 100],
  },

  async redirects() {
    return [
      {
        source: "/docs",
        destination: "/docs/get-started/overview",
        permanent: true,
      },
      {
        source: "/docs/api",
        destination: "/docs/api-reference/getting-started/overview",
        permanent: true,
      },
      {
        source: "/docs/api-reference",
        destination: "/docs/api-reference/getting-started/overview",
        permanent: true,
      },
      // Section roots — redirect to first page since no index.mdx exists
      {
        source: "/docs/get-started",
        destination: "/docs/get-started/overview",
        permanent: true,
      },
      {
        source: "/docs/connectors",
        destination: "/docs/connectors/github",
        permanent: true,
      },
      {
        source: "/docs/integrate",
        destination: "/docs/integrate/sdk",
        permanent: true,
      },
      {
        source: "/docs/api-reference/getting-started",
        destination: "/docs/api-reference/getting-started/overview",
        permanent: true,
      },
      {
        source: "/docs/api-reference/sdks-tools",
        destination: "/docs/api-reference/sdks-tools/typescript-sdk",
        permanent: true,
      },
    ];
  },

  /** Enables hot reloading for local packages without a build step */
  transpilePackages: [
    "@repo/og",
    "@vendor/aeo",
    "@vendor/analytics",
    "@vendor/cms",
    "@vendor/email",
    "@vendor/inngest",
    "@vendor/next",
    "@vendor/observability",
    "@vendor/security",
    "@vendor/seo",
  ],

  typedRoutes: true,

  // Add automatic static optimization where possible
  experimental: {
    optimizePackageImports: [
      "framer-motion",
      "date-fns",
      "class-variance-authority",
      // lucide-react ships hundreds of icons — optimizePackageImports
      // makes the compiler only bundle the specific icons imported rather
      // than the full barrel, eliminating dead icon code from every chunk.
      "lucide-react",
    ],
  },

  // Note: /docs routing is handled by @vercel/microfrontends via
  // apps/app/microfrontends.json. No manual rewrites needed.
};

// Build config using vendor utilities (cast at Next.js 15/16 boundary)
let config = withBetterStack(
  mergeNextConfig(
    vendorConfig,
    wwwConfig as Parameters<typeof mergeNextConfig>[1]
  )
) as NextConfig;

if (env.VERCEL) {
  config = withSentry(config as Parameters<typeof withSentry>[0]) as NextConfig;
}

// Enable bundle analysis when requested
if (process.env.ANALYZE === "true") {
  config = withAnalyzer(
    config as Parameters<typeof withAnalyzer>[0]
  ) as NextConfig;
}

const withMDX = createMDX();

export default withMicrofrontends(withMDX(config), {
  debug: process.env.NODE_ENV === "development",
});
