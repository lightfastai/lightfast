import { Suspense } from "react";
import { notFound } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { Skeleton } from "@repo/ui/components/ui/skeleton";
import { prefetch, HydrateClient, trpc } from "@repo/console-trpc/server";
import { WorkspaceGeneralSettingsClient } from "./_components/workspace-general-settings-client";

export default async function WorkspaceSettingsPage({
	params,
}: {
	params: Promise<{ slug: string; workspaceName: string }>;
}) {
	// Parent org layout handles membership; settings layout handles admin role
	const { slug, workspaceName } = await params;
	const { orgId } = await auth();

	if (!orgId) {
		notFound();
	}

	// Prefetch workspace details for instant loading
	// CRITICAL: This must happen BEFORE HydrateClient wrapping
	prefetch(
		trpc.workspace.getByName.queryOptions({
			clerkOrgSlug: slug,
			workspaceName,
		}),
	);

	return (
		<HydrateClient>
			<Suspense fallback={<WorkspaceGeneralSettingsSkeleton />}>
				<WorkspaceGeneralSettingsClient
					slug={slug}
					workspaceName={workspaceName}
				/>
			</Suspense>
		</HydrateClient>
	);
}

function WorkspaceGeneralSettingsSkeleton() {
	return (
		<div className="space-y-8">
			{/* Workspace Name Section */}
			<div className="space-y-4">
				<div>
					<Skeleton className="h-7 w-48" />
					<Skeleton className="h-4 w-72 mt-2" />
				</div>
				<div className="w-full space-y-4">
					<Skeleton className="h-10 w-full" />
					<Skeleton className="h-4 w-56" />
					<div className="flex justify-end">
						<Skeleton className="h-9 w-16" />
					</div>
				</div>
			</div>

			{/* Workspace Slug Section */}
			<div className="space-y-4">
				<div>
					<Skeleton className="h-7 w-40" />
					<Skeleton className="h-4 w-64 mt-2" />
				</div>
				<Skeleton className="h-10 w-full" />
			</div>
		</div>
	);
}
