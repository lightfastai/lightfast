import { withMicrofrontends } from "@vercel/microfrontends/next/config";
import type { NextConfig } from "next";

import "~/env";

import { mergeNextConfig } from "@vendor/next/merge-config";
import {
  config as vendorConfig,
  withBetterStack,
  withSentry,
} from "@vendor/next/next-config-builder";

import { env } from "~/env";

let config: NextConfig = withBetterStack(
  mergeNextConfig(vendorConfig, {
    transpilePackages: [
      "@repo/ui",
      "@vendor/seo",
      "@vendor/observability",
      "@vendor/next",
      "@vendor/clerk",
      "@vendor/analytics",
    ],
  })
);

if (env.VERCEL) {
  config = withSentry(config);
}

export default withMicrofrontends(config, { debug: true });
