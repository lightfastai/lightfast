import { Suspense } from "react";
import { prefetch, HydrateClient, userTrpc } from "@repo/console-trpc/server";
import { SourcesHeader } from "./_components/sources-header";
import { SourcesList } from "./_components/sources-list";
import { SourcesListLoading } from "./_components/sources-list-loading";

/**
 * Sources Settings Page (Server Component)
 *
 * Architecture:
 * - Server component: Static header with prefetch
 * - Client island: Interactive sources list
 * - Suspense boundary: Only around data-dependent list
 *
 * Performance pattern:
 * - Server-side prefetch of integrations (30-90x faster)
 * - HydrateClient for server-to-client state transfer
 * - Client component uses prefetched data via useSuspenseQuery
 * - No client-side fetch on mount (prevents UNAUTHORIZED errors)
 *
 * Pattern:
 * 1. prefetch() runs in server component (adds data to query client)
 * 2. HydrateClient wraps client components (dehydrates WITH data)
 * 3. useSuspenseQuery in client finds data in cache (no fetch!)
 * 4. Suspense shows loading state during hydration
 */
export default function SourcesSettingsPage() {
	// Prefetch user's personal integrations
	// CRITICAL: This must happen BEFORE HydrateClient wrapping
	prefetch(userTrpc.userSources.list.queryOptions());

	return (
		<div className="space-y-6">
			{/* Static Header (Server Component) */}
			<SourcesHeader />

			{/* Client Island with Suspense boundary */}
			<HydrateClient>
				<Suspense fallback={<SourcesListLoading />}>
					<SourcesList />
				</Suspense>
			</HydrateClient>
		</div>
	);
}
