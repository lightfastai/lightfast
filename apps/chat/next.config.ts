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
			"@repo/site-config",
			"@repo/url-utils",
			"@vendor/clerk",
			"@vendor/observability",
			"@vendor/next",
			"@vendor/trpc",
			"@db/chat",
			"lightfast",
		],
		experimental: {
			optimizeCss: true,
			optimizePackageImports: ["@repo/ui", "lucide-react"],
			/**
			 * Router Cache Configuration (staleTimes)
			 *
			 * CRITICAL: This fixes the blocking navigation issue in Next.js 15.
			 *
			 * Problem:
			 * - Next.js 15 changed the default staleTime for pages from 30s to 0 (no caching)
			 * - This causes RSC fetches (?_rsc=) on every navigation instead of using client-side navigation
			 * - After a hard refresh, navigating back to that same page would trigger a blocking RSC fetch
			 *
			 * Solution:
			 * - Setting staleTimes restores Next.js 14 behavior where pages are cached in the Router Cache
			 * - This enables instant client-side navigation without RSC fetches for recently visited pages
			 *
			 * How it works:
			 * - dynamic: Time in seconds to cache pages with dynamic routes (e.g., /[sessionId])
			 * - static: Time in seconds to cache statically generated pages or when prefetch=true
			 *
			 * @see https://nextjs.org/docs/app/api-reference/config/next-config-js/staleTimes
			 * @see https://nextjs.org/blog/next-15#client-router-cache-no-longer-caches-page-components-by-default
			 */
			staleTimes: {
				dynamic: 30, // Cache dynamic pages for 30 seconds (same as Next.js 14 default)
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
