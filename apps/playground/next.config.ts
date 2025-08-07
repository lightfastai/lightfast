import type { NextConfig } from "next";

import "~/env";

import {
  config as vendorConfig,
  withBetterStack,
  withSentry,
} from "@vendor/next/next-config-builder";
import { mergeNextConfig } from "@vendor/next/merge-config";

import { env } from "~/env";

// Determine the asset prefix based on environment
function getAssetPrefix(): string | undefined {
  // In development, no prefix needed
  if (env.NODE_ENV === 'development') {
    return undefined;
  }

  // In Vercel preview deployments
  if (env.VERCEL_ENV === 'preview' && env.VERCEL_URL) {
    // For preview deployments, use the Vercel URL without /playground
    // since basePath already adds it
    return `https://${env.VERCEL_URL}`;
  }

  // In production - use the playground subdomain without /playground path
  // The basePath configuration already handles the /playground path
  if (env.VERCEL_ENV === 'production') {
    return 'https://playground.lightfast.ai';
  }

  // Default to undefined for local dev
  return undefined;
}

let config: NextConfig = withBetterStack(
  mergeNextConfig(vendorConfig, {
    reactStrictMode: true,
    basePath: '/playground',
    assetPrefix: getAssetPrefix(),
    typescript: {
      ignoreBuildErrors: true,
    },
    eslint: {
      ignoreDuringBuilds: true,
    },
    experimental: {
      serverActions: {
        allowedOrigins: [
          'app.lightfast.ai',
          'https://app.lightfast.ai',
          'localhost:4103',
          'http://localhost:4103',
        ],
      },
      instrumentationHook: true,
      optimizeCss: true,
      optimizePackageImports: [
        "@repo/ui",
        "@repo/lightfast-react",
        "jotai",
        "lucide-react",
        "@tanstack/react-query",
      ],
    },
    transpilePackages: [
      "@repo/ui",
      "@repo/lightfast-react",
      "@repo/lightfast-config",
      "@repo/ai",
      "@repo/url-utils",
      "@lightfast/core",
      "@vendor/observability",
      "@vendor/next",
      "@vendor/storage",
    ],
    images: {
      remotePatterns: [
        {
          protocol: 'https' as const,
          hostname: new URL(env.BLOB_BASE_URI).hostname,
        },
      ],
    },
  })
);

// Apply Sentry configuration in Vercel environment
if (env.VERCEL) {
  config = withSentry(config);
}

export default config;