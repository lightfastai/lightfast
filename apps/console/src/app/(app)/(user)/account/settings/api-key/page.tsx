import { Suspense } from "react";
import { prefetch, HydrateClient, userTrpc } from "@repo/console-trpc/server";
import { ApiKeyList } from "./_components/api-key-list";
import { ApiKeyListLoading } from "./_components/api-key-list-loading";
import { SecurityNotice } from "./_components/security-notice";

/**
 * API Key Settings Page
 *
 * Server component with client islands for optimal SSR performance.
 *
 * Architecture:
 * - Server components: Static headers, security notice, loading skeletons
 * - Client island: Interactive API key list with mutations
 * - Suspense boundary: Wraps only the data-fetching component
 *
 * Performance pattern:
 * - Server-side prefetch of API keys
 * - HydrateClient for server-to-client state transfer
 * - Client component uses prefetched data via useSuspenseQuery
 * - No client-side fetch on mount (prevents UNAUTHORIZED errors)
 * - Suspense boundary provides granular loading state
 */
export default function ApiKeySettingsPage() {
	// Prefetch API keys for instant loading
	// CRITICAL: This must happen BEFORE HydrateClient wrapping
	prefetch(userTrpc.account.apiKeys.list.queryOptions());

	return (
		<div className="space-y-8">
			{/* Client Island wrapped in HydrateClient */}
			<HydrateClient>
				{/* Suspense only around data-dependent component */}
				<Suspense fallback={<ApiKeyListLoading />}>
					<ApiKeyList />
				</Suspense>
			</HydrateClient>

			{/* Static Security Notice - Server Component */}
			<SecurityNotice />
		</div>
	);
}
