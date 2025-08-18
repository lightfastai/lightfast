"use client";

import { useRouterCacheWarmer } from "~/hooks/use-router-cache-warmer";

/**
 * Client component that warms the router cache after hard refresh
 * This prevents RSC fetches when navigating back to the hard-refreshed page
 */
export function RouterCacheWarmer() {
	useRouterCacheWarmer();
	return null;
}