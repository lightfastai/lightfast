import { NextConfig } from "next";

import "./src/env";

import {
  config as vendorConfig,
  withBetterStack,
  withSentry,
} from "@vendor/next/next-config-builder";
import { playgroundUrl } from "./src/lib/related-projects";

import { env } from "./src/env";

let config: NextConfig = withBetterStack({
	reactStrictMode: true,
	transpilePackages: [
		"@repo/ui",
		"@repo/lightfast-config",
		"@repo/lightfast-react",
		"@repo/url-utils",
		"@vendor/clerk",
		"@vendor/observability",
		"@vendor/next",
	],
	experimental: {
		optimizeCss: true,
		optimizePackageImports: ["@repo/ui", "lucide-react"],
	},
	async rewrites() {
		// The playgroundUrl helper handles both dev (localhost:4105) and production URLs
		return [
			{
				source: '/playground',
				destination: `${playgroundUrl}/playground`,
			},
			{
				source: '/playground/:path*',
				destination: `${playgroundUrl}/playground/:path*`,
			},
		];
	},
	...vendorConfig,
});

// Apply Sentry configuration in Vercel environment
if (env.VERCEL) {
	config = withSentry(config);
}

export default config;

