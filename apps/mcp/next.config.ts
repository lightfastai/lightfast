import { withSentryConfig } from "@sentry/nextjs";
import { baseConfig, sentryOptions } from "@vendor/next/config";
import type { NextConfig } from "next";
import "./src/env";

const mcpConfig = {
  ...baseConfig,
  transpilePackages: [
    "@api/app",
    "@db/app",
    "@repo/api-contract",
    "@repo/mcp-tools",
    "@vendor/mcp",
    "@vendor/next",
    "@vendor/observability",
    "@vendor/security",
  ],
  experimental: {
    ...baseConfig.experimental,
    optimizePackageImports: [
      ...(baseConfig.experimental?.optimizePackageImports ?? []),
      "@repo/mcp-tools",
      "@vendor/observability",
      "@vendor/security",
    ],
  },
} satisfies NextConfig;

export default withSentryConfig(mcpConfig, sentryOptions);
