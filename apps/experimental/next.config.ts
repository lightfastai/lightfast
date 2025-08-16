import type { NextConfig } from "next";
import "./src/env";

import {
	config as vendorConfig,
	withBetterStack,
	withSentry,
} from "@vendor/next/next-config-builder";
import { mergeNextConfig } from "@vendor/next/merge-config";

let nextConfig: NextConfig = withBetterStack(
	mergeNextConfig(vendorConfig, {
		/** Enables hot reloading for local packages without a build step */
		transpilePackages: [
			"@repo/ui",
			"@repo/lightfast-config",
			"@lightfastai/core",
			"@lightfast/types",
			"@lightfast/evals",
			"@vendor/analytics",
		],
		experimental: {
			/** Optimize client-side routing */
			optimizePackageImports: ["@ai-sdk/react"],
		},
		eslint: {
			ignoreDuringBuilds: true,
		},
	})
);

// Apply Sentry configuration in Vercel environment
if (process.env.VERCEL) {
	nextConfig = withSentry(nextConfig);
}

export default nextConfig;
