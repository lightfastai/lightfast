import { notFound } from "next/navigation";
import { Suspense } from "react";
import { RepositoriesSettings } from "~/components/repositories-settings";
import { requireOrgAccess } from "~/lib/org-access-clerk";
import { prefetch, trpc, HydrateClient } from "@repo/console-trpc/server";
import { Skeleton } from "@repo/ui/components/ui/skeleton";

export default async function RepositoriesPage({
	params,
}: {
	params: Promise<{ slug: string }>;
}) {
	// Note: Auth is handled by middleware (auth.protect())
	const { slug } = await params;

	// Verify user has access to this organization
	let access;
	try {
		access = await requireOrgAccess(slug);
	} catch {
		notFound();
	}

	// Prefetch repositories to avoid loading state
	prefetch(
		trpc.repository.list.queryOptions({
			includeInactive: false,
			organizationId: access.org.id,
		})
	);

	return (
		<HydrateClient>
			<Suspense fallback={<RepositoriesSettingsSkeleton />}>
				<RepositoriesSettings
					organizationId={access.org.id}
					githubOrgId={access.org.githubOrgId}
				/>
			</Suspense>
		</HydrateClient>
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
