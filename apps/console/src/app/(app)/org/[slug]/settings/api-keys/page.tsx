import { redirect, notFound } from "next/navigation";
import { Suspense } from "react";
import { auth } from "@clerk/nextjs/server";
import { ApiKeysSettings } from "~/components/settings/api-keys/api-keys-settings";
import { requireOrgAccess } from "~/lib/org-access-clerk";
import { prefetch, trpc, HydrateClient } from "@repo/console-trpc/server";
import { Skeleton } from "@repo/ui/components/ui/skeleton";

export default async function ApiKeysPage({
	params,
}: {
	params: Promise<{ slug: string }>;
}) {
	const { userId } = await auth();
	if (!userId) {
		redirect("/sign-in");
	}

	const { slug } = await params;

	// Verify user has access to this organization
	let access;
	try {
		access = await requireOrgAccess(slug);
	} catch {
		notFound();
	}

	// Prefetch API keys to avoid loading state
	prefetch(
		trpc.apiKey.list.queryOptions({
			organizationId: access.org.id,
		})
	);

	return (
		<HydrateClient>
			<Suspense fallback={<ApiKeysSettingsSkeleton />}>
				<ApiKeysSettings organizationId={access.org.id} />
			</Suspense>
		</HydrateClient>
	);
}

function ApiKeysSettingsSkeleton() {
	return (
		<div className="space-y-6">
			<div className="rounded-lg border border-border/60 p-6">
				<div className="flex items-center justify-between mb-6">
					<div className="space-y-2">
						<Skeleton className="h-6 w-48" />
						<Skeleton className="h-4 w-64" />
					</div>
					<Skeleton className="h-9 w-32" />
				</div>
				<div className="space-y-3">
					<Skeleton className="h-24 w-full" />
					<Skeleton className="h-24 w-full" />
				</div>
			</div>
		</div>
	);
}
