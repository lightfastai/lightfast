import { notFound } from "next/navigation";
import { Suspense } from "react";
import { auth } from "@clerk/nextjs/server";
import { RepositoriesSettings } from "~/components/repositories-settings";
import { prefetch, trpc } from "@repo/console-trpc/server";
import { Skeleton } from "@repo/ui/components/ui/skeleton";

export default async function RepositoriesPage({
	params: _params,
}: {
	params: Promise<{ slug: string }>;
}) {
	const { orgId } = await auth();
	if (!orgId) {
		notFound();
	}

	// Prefetch page-specific data using orgId from middleware
	prefetch(
		trpc.repository.list.queryOptions({
			includeInactive: false,
			clerkOrgId: orgId,
		})
	);

	// Org layout already wraps in HydrateClient and ErrorBoundary
	return (
		<Suspense fallback={<RepositoriesSettingsSkeleton />}>
			<RepositoriesSettings />
		</Suspense>
	);
}

function RepositoriesSettingsSkeleton() {
	return (
		<div className="space-y-6">
			<div className="rounded-lg border border-border/60 p-6">
				<div className="flex items-center justify-between mb-6">
					<div className="space-y-2">
						<Skeleton className="h-6 w-48" />
						<Skeleton className="h-4 w-64" />
					</div>
				</div>
				<div className="space-y-3">
					<Skeleton className="h-24 w-full" />
					<Skeleton className="h-24 w-full" />
				</div>
			</div>
		</div>
	);
}
