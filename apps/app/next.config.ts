import { NextConfig } from "next";
import { withVercelToolbar } from "@vercel/toolbar/plugins/next";
import { withSentry } from "@vendor/next/next-config-builder";
import { playgroundUrl } from "./src/lib/related-projects";
import { env } from "./src/env";

let config: NextConfig = {
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
		instrumentationHook: true,
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
};

// Apply Sentry configuration in Vercel environment
if (env.VERCEL) {
	config = withSentry(config);
}

export default withVercelToolbar()(config);

