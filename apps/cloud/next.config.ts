import { NextConfig } from "next";

import "./src/env";

import {
	config as vendorConfig,
	withBetterStack,
	withSentry,
} from "@vendor/next/next-config-builder";
import { mergeNextConfig } from "@vendor/next/merge-config";
import { playgroundUrl } from "./src/lib/related-projects";

import { env } from "./src/env";

let config: NextConfig = withBetterStack(
	mergeNextConfig(vendorConfig, {
		reactStrictMode: true,
		eslint: {
			ignoreDuringBuilds: true, // Temporarily disable ESLint during build
		},
		transpilePackages: [
			"@api/cli",
			"@api/cloud",
			"@db/cloud",
			"@vendor/upstash",
			"@repo/ui",
			"@repo/site-config",
			"@repo/url-utils",
			"@vendor/seo",
			"@vendor/clerk",
			"@vendor/observability",
			"@vendor/next",
		],
		experimental: {
			optimizeCss: true,
			optimizePackageImports: ["@repo/ui", "lucide-react"],
		},
		async rewrites() {
			// App-specific rewrites only - will be merged with vendor rewrites
			return [
				{
					source: "/playground",
					destination: `${playgroundUrl}/playground`,
				},
				{
					source: "/playground/:path*",
					destination: `${playgroundUrl}/playground/:path*`,
				},
			];
		},
	}),
);

// Apply Sentry configuration in Vercel environment
if (env.VERCEL) {
	config = withSentry(config);
}

export default config;
