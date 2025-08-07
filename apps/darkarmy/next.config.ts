import { NextConfig } from "next";
import {
  config as vendorConfig,
  withBetterStack,
  withSentry,
} from "@vendor/next/next-config-builder";
import { mergeNextConfig } from "@vendor/next/merge-config";

let config: NextConfig = withBetterStack(
  mergeNextConfig(vendorConfig, {
    reactStrictMode: true,
    transpilePackages: ["@repo/ui"],
  })
);

// Apply Sentry configuration in Vercel environment
if (process.env.VERCEL) {
  config = withSentry(config);
}

export default config;