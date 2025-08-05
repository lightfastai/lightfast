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
    "@repo/lightfast-config",
    "@repo/lightfast-react",
    "@repo/url-utils",
    "@vendor/observability",
    "@vendor/next",
    "@vendor/clerk",
    "@vendor/analytics",
    "@vendor/db",
  ],
  ...vendorConfig,
});

if (env.VERCEL) {
  config = withSentry(config);
}

export default config;