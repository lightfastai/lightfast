import { NextConfig } from "next";

import "./src/env";

import {
	config as vendorConfig,
	withBetterStack,
	withSentry,
} from "@vendor/next/next-config-builder";
import { mergeNextConfig } from "@vendor/next/merge-config";

import { env } from "./src/env";

let config: NextConfig = withBetterStack(
	mergeNextConfig(vendorConfig, {
		reactStrictMode: true,
		transpilePackages: [
			"@repo/ui",
			"@repo/lightfast-config",
			"@repo/lightfast-react",
			"@repo/url-utils",
			"@vendor/clerk",
			"@vendor/observability",
			"@vendor/next",
			"@vendor/trpc",
			"@vendor/db",
			"@lightfastai/core",
		],
		experimental: {
			optimizeCss: true,
			optimizePackageImports: ["@repo/ui", "lucide-react"],
			// Configure Router Cache to cache pages for 30 seconds (like Next.js 14)
			// This prevents RSC fetches when navigating back to previously visited pages
			staleTimes: {
				dynamic: 30, // Cache dynamic pages for 30 seconds
				static: 180, // Cache static pages for 3 minutes
			},
		},
	}),
);

// Apply Sentry configuration in Vercel environment
if (env.VERCEL) {
	config = withSentry(config);
}

export default config;

