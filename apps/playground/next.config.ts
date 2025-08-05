import type { NextConfig } from "next";
import { withMicrofrontends } from "@vercel/microfrontends/next/config";
import { withVercelToolbar } from "@vercel/toolbar/plugins/next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
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

export default withVercelToolbar()(
  withMicrofrontends(nextConfig, { debug: true })
);