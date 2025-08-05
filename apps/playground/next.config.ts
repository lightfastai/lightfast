import type { NextConfig } from "next";
import { withVercelToolbar } from "@vercel/toolbar/plugins/next";
import "~/env";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  basePath: '/playground',
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  experimental: {
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
    "@lightfast/core",
  ],
};

export default withVercelToolbar()(nextConfig);