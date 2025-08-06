import type { NextConfig } from "next";
import { withVercelToolbar } from "@vercel/toolbar/plugins/next";
import "~/env";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  basePath: '/playground',
  assetPrefix: process.env.NODE_ENV === 'production' ? 'https://playground.lightfast.ai/playground' : undefined,
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