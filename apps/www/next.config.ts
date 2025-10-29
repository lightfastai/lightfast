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
		// eslint: { ignoreDuringBuilds: true },
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
			],
			// Faster navigation for production
			// ppr: true,
		},

        // Note: Rewrites for /docs are handled automatically by @vercel/microfrontends
        // via microfrontends.json configuration. Manual rewrites are not needed.
    }),
);

if (env.VERCEL) {
	config = withSentry(config);
}

export default withMicrofrontends(config, { debug: true });
