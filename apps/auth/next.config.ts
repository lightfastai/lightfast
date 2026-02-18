import { NextConfig } from "next";
import { withMicrofrontends } from "@vercel/microfrontends/next/config";

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
		transpilePackages: [
			"@repo/og",
			"@repo/ui",
			"@repo/site-config",
			"@repo/url-utils",
			"@vendor/seo",
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

export default withMicrofrontends(config, { debug: true });
