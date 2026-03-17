import { withMicrofrontends } from "@vercel/microfrontends/next/config";
import type { NextConfig } from "next";

import "~/env";

import { mergeNextConfig } from "@vendor/next/merge-config";
import {
  config as vendorConfig,
  withBetterStack,
  withSentry,
} from "@vendor/next/next-config-builder";

const baseConfig: NextConfig = withBetterStack(
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

export default withMicrofrontends(withSentry(baseConfig), { debug: true });
