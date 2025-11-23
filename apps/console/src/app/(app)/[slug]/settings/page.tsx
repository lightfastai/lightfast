import { Suspense } from "react";
import { notFound } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { Skeleton } from "@repo/ui/components/ui/skeleton";
import { HydrateClient } from "@repo/console-trpc/server";
import { TeamGeneralSettingsClient } from "./_components/team-general-settings-client";

export default async function SettingsPage({
	params,
}: {
	params: Promise<{ slug: string }>;
}) {
	// Parent org layout handles membership; settings layout handles admin role
	const { slug } = await params;
	const { orgId } = await auth();

	if (!orgId) {
		notFound();
	}

	// Note: We rely on listUserOrganizations cache from (app)/layout.tsx
	// No separate prefetch needed - avoids Clerk propagation timing issues
	// The client component will find the org from the cached list by slug

	return (
		<HydrateClient>
			<Suspense fallback={<GeneralSettingsSkeleton />}>
				<TeamGeneralSettingsClient slug={slug} organizationId={orgId} />
			</Suspense>
		</HydrateClient>
	);
}

function GeneralSettingsSkeleton() {
	return (
		<div className="space-y-8">
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
		</div>
	);
}
