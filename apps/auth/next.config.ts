import { NextConfig } from "next";

import "~/env";

import {
  config as vendorConfig,
  withBetterStack,
  withSentry,
} from "@vendor/next/next-config-builder";

import { env } from "~/env";

let config: NextConfig = withBetterStack({
  reactStrictMode: true,
  transpilePackages: [
    "@repo/ui",
    "@vendor/observability",
    "@vendor/next",
    "@vendor/clerk",
  ],
  ...vendorConfig,
});

if (env.VERCEL) {
  config = withSentry(config);
}

export default config;