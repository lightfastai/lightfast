import { NextConfig } from "next";

import "~/env";

import {
	config as vendorConfig,
	withBetterStack,
	withSentry,
} from "@vendor/next/next-config-builder";
import { mergeNextConfig } from "@vendor/next/merge-config";

import { env } from "~/env";

let config: NextConfig = withBetterStack(
	mergeNextConfig(vendorConfig, {
		reactStrictMode: true,
		transpilePackages: [
			"@repo/ui",
			"@repo/site-config",
			"@repo/url-utils",
			"@vendor/observability",
			"@vendor/next",
			"@vendor/clerk",
			"@vendor/analytics",
		],
	}),
);

if (env.VERCEL) {
	config = withSentry(config);
}

export default config;

