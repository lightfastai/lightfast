import { Suspense } from "react";
import { prefetch, trpc, HydrateClient } from "@repo/console-trpc/server";
import { ProfileDataDisplay } from "./_components/profile-data-display";
import { ProfileDataLoading } from "./_components/profile-data-loading";

/**
 * General Settings Page
 *
 * Server component with optimized SSR architecture.
 *
 * Architecture:
 * - Server component: Page wrapper and static structure
 * - Client island: ProfileDataDisplay (profile data with useSuspenseQuery)
 * - Suspense boundary: Wraps ONLY the component using useSuspenseQuery
 * - Loading state: Granular skeleton matching the profile layout
 *
 * Performance pattern:
 * - Server-side prefetch of profile data (30-90x faster)
 * - HydrateClient for server-to-client state transfer
 * - Client component uses prefetched data via useSuspenseQuery
 * - No client-side fetch on mount (prevents UNAUTHORIZED errors)
 * - refetchOnMount/refetchOnWindowFocus disabled
 */
export default function GeneralSettingsPage() {
	// CRITICAL: Prefetch BEFORE HydrateClient wrapping
	prefetch(trpc.account.profile.get.queryOptions());

	return (
		<HydrateClient>
			<Suspense fallback={<ProfileDataLoading />}>
				<ProfileDataDisplay />
			</Suspense>
		</HydrateClient>
	);
}
