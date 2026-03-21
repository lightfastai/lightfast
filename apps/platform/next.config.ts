import { mergeNextConfig } from "@vendor/next/merge-config";
import {
  config as vendorConfig,
  withBetterStack,
  withSentry,
} from "@vendor/next/next-config-builder";
import type { NextConfig } from "next";

const config: NextConfig = withSentry(
  withBetterStack(
    mergeNextConfig(vendorConfig, {
      transpilePackages: [
        "@api/platform",
        "@db/app",
        "@repo/app-providers",
        "@repo/lib",
        "@vendor/inngest",
        "@vendor/next",
        "@vendor/observability",
        "@vendor/security",
        "@vendor/upstash",
      ],
      experimental: {
        optimizePackageImports: ["@repo/lib", "@vendor/observability"],
      },
    })
  )
);

export default config;
