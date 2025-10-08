import { redirect, notFound } from "next/navigation";
import { Suspense } from "react";
import { auth } from "@clerk/nextjs/server";
import { RepositoriesSettings } from "~/components/repositories-settings";
import { verifyOrgAccess } from "~/lib/org-access";
import { prefetch, trpc, HydrateClient } from "@repo/deus-trpc/server";
import { Skeleton } from "@repo/ui/components/ui/skeleton";

export default async function RepositoriesPage({
	params,
}: {
	params: Promise<{ orgId: string }>;
}) {
	const { userId } = await auth();
	if (!userId) {
		redirect("/sign-in");
	}

	const { orgId } = await params;
	const githubOrgId = parseInt(orgId, 10);

	if (isNaN(githubOrgId)) {
		notFound();
	}

	// Verify user has access to this organization
	const access = await verifyOrgAccess(userId, githubOrgId);

	if (!access.hasAccess) {
		redirect("/onboarding");
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
				<RepositoriesSettings organizationId={access.org.id} />
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
