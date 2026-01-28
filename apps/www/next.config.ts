import { NextConfig } from "next";
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

let config: NextConfig = withBetterStack(
    mergeNextConfig(vendorConfig, {
        reactStrictMode: true,

		/** Enables hot reloading for local packages without a build step */
		transpilePackages: [
			"@repo/ui",
			"@vendor/seo",
			"@vendor/security",
			"@vendor/analytics",
			"@vendor/email",
			"@vendor/clerk",
			"@vendor/inngest",
			"@vendor/observability",
			"@vendor/next",
			"@vendor/upstash",
			"@vendor/cms",
			"@repo/site-config",
			"@repo/email",
			"@repo/lib",
		],

		/** We already do linting and typechecking as separate tasks in CI */
		eslint: { ignoreDuringBuilds: true },
		// typescript: { ignoreBuildErrors: true },

		// Add automatic static optimization where possible
		experimental: {
			// For Next.js 15.3+
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
			],
			// Faster navigation for production
			// ppr: true,
		},

		// Note: /docs routing is handled by @vercel/microfrontends via
		// apps/console/microfrontends.json. No manual rewrites needed.
    }),
);

if (env.VERCEL) {
	config = withSentry(config);
}

// Enable bundle analysis when requested
if (process.env.ANALYZE === "true") {
	config = withAnalyzer(config);
}

export default withMicrofrontends(config, { debug: true });
