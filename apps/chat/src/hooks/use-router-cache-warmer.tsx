"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";

/**
 * Hook that pre-warms the Next.js Router Cache by prefetching the current page
 * This solves the issue where after a hard refresh, navigating back to the same page
 * triggers an RSC fetch instead of using client-side navigation
 */
export function useRouterCacheWarmer() {
	const router = useRouter();
	const pathname = usePathname();

	useEffect(() => {
		// After mount (which happens after a hard refresh), prefetch the current page
		// This ensures the Router Cache has the RSC payload for this page
		// preventing blocking RSC fetches when navigating back here
		
		// Small delay to ensure the page is fully loaded
		const timer = setTimeout(() => {
			// Prefetch the current page to warm the router cache
			router.prefetch(pathname);
		}, 100);

		return () => clearTimeout(timer);
	}, [pathname, router]);
}