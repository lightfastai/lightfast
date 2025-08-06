import type { NextConfig } from "next";
import { withVercelToolbar } from "@vercel/toolbar/plugins/next";
import { env } from "~/env";

// Determine the asset prefix based on environment
function getAssetPrefix(): string | undefined {
  // In development, no prefix needed
  if (env.NODE_ENV === 'development') {
    return undefined;
  }

  // In Vercel preview deployments
  if (env.VERCEL_ENV === 'preview' && env.VERCEL_URL) {
    return `https://${env.VERCEL_URL}/playground`;
  }

  // In production
  if (env.VERCEL_ENV === 'production') {
    return 'https://playground.lightfast.ai/playground';
  }

  // Default to undefined for local dev
  return undefined;
}

const nextConfig: NextConfig = {
  reactStrictMode: true,
  basePath: '/playground',
  assetPrefix: getAssetPrefix(),
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '71rhzdwymx1lzqpv.public.blob.vercel-storage.com',
      },
    ],
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
  ],
};

export default withVercelToolbar()(nextConfig);