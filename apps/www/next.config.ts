import type { NextConfig } from "next";
import { withMicrofrontends } from "@vercel/microfrontends/next/config";

import "~/env";

import {
	config as vendorConfig,
	withBetterStack,
	withSentry,
	withAnalyzer,
} from "@vendor/next/next-config-builder";
import { mergeNextConfig } from "@vendor/next/merge-config";

import { env } from "~/env";

/**
 * Type-safe config for Next.js 16.
 *
 * The vendor functions are typed with Next.js 15's NextConfig, so we cast
 * at the boundary where we call them. The final config is properly typed
 * with Next.js 16's NextConfig.
 */
const wwwConfig: NextConfig = {
	reactStrictMode: true,

	// Next.js 16 requires explicit quality values
	images: {
		qualities: [10, 75, 100],
	},

	/** Enables hot reloading for local packages without a build step */
	transpilePackages: [
		"@repo/ui",
		"@vendor/seo",
		"@vendor/security",
		"@vendor/analytics",
		"@vendor/email",
		"@vendor/inngest",
		"@vendor/observability",
		"@vendor/next",
		"@vendor/upstash",
		"@vendor/cms",
		"@repo/site-config",
		"@repo/email",
		"@repo/lib",
		"@paper-design/shaders-react",
		"@paper-design/shaders",
	],

	// Add automatic static optimization where possible
	experimental: {
		optimizeCss: true,
		optimizePackageImports: [
			"@repo/ui",
			"jotai",
			"lucide-react",
			"react-confetti",
			"framer-motion",
			"date-fns",
			"class-variance-authority",
			"clsx",
			"tailwind-merge",
			"@paper-design/shaders-react",
		],
	},

	// Note: /docs routing is handled by @vercel/microfrontends via
	// apps/console/microfrontends.json. No manual rewrites needed.
};

// Build config using vendor utilities (cast at Next.js 15/16 boundary)
let config = withBetterStack(
	mergeNextConfig(vendorConfig, wwwConfig as Parameters<typeof mergeNextConfig>[1]),
) as NextConfig;

if (env.VERCEL) {
	config = withSentry(config as Parameters<typeof withSentry>[0]) as NextConfig;
}

// Enable bundle analysis when requested
if (process.env.ANALYZE === "true") {
	config = withAnalyzer(config as Parameters<typeof withAnalyzer>[0]) as NextConfig;
}

export default withMicrofrontends(config, { debug: true });
