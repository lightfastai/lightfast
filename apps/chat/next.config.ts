import { NextConfig } from "next";

import "./src/env";

import {
	config as vendorConfig,
	withBetterStack,
	withSentry,
	withAnalyzer,
} from "@vendor/next/next-config-builder";
import { mergeNextConfig } from "@vendor/next/merge-config";

import { env } from "./src/env";

let config: NextConfig = withBetterStack(
	mergeNextConfig(vendorConfig, {
		transpilePackages: [
			"@repo/ai",
			"@api/chat",
			"@repo/ui",
			"@repo/site-config",
			"@repo/url-utils",
			"@repo/chat-ai",
			"@repo/chat-billing",
			"@repo/chat-ai-types",
			"@repo/chat-trpc",
			"@repo/chat-api-services",
			"@vendor/seo",
			"@vendor/clerk",
			"@vendor/observability",
			"@vendor/next",
			"@db/chat",
			"lightfast",
			"@repo/lib",
			"@vendor/analytics",
			"@vendor/inngest",
			"@vendor/security",
			"@repo/eslint-config",
			"@repo/typescript-config",
		],
		experimental: {
			optimizePackageImports: [
				"@repo/ai",
				"@api/chat",
				"@repo/lib",
				"@vendor/clerk",
				"@vendor/observability",
				"@vendor/analytics",
				"streamdown",
				"@radix-ui/react-accordion",
				"@radix-ui/react-avatar",
				"@radix-ui/react-collapsible",
				"@radix-ui/react-popover",
				"@radix-ui/react-dialog",
				"@radix-ui/react-dropdown-menu",
				"@radix-ui/react-select",
				"@radix-ui/react-tabs",
				"@radix-ui/react-tooltip",
				"@radix-ui/react-scroll-area",
				"react-hook-form",
				"zod",
				"date-fns",
				"class-variance-authority",
				"clsx",
				"tailwind-merge",
			],

			/**
			 * Static Generation Configuration
			 * Controls retry behavior for failed static generation
			 */
			staticGenerationRetryCount: 3,
			staticGenerationMaxConcurrency: 8,
		},

		turbopack: {
			resolveAlias: {
				// Optimize commonly used imports
				"~/*": "./src/*",
			},
			resolveExtensions: [
				".mdx",
				".tsx",
				".ts",
				".jsx",
				".js",
				".mjs",
				".json",
			],
		},
	}),
);

// Apply Sentry configuration in Vercel environment
if (env.VERCEL) {
	config = withSentry(config);
}

// Enable bundle analysis when requested
if (process.env.ANALYZE === "true") {
	config = withAnalyzer(config);
}

export default config;
