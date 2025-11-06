import { redirect, notFound } from "next/navigation";
import { Suspense } from "react";
import { auth } from "@clerk/nextjs/server";
import { CodeReviewSettings } from "~/components/code-review-settings";
import { requireOrgAccess } from "~/lib/org-access-clerk";
import { prefetch, trpc, HydrateClient } from "@repo/console-trpc/server";
import { Skeleton } from "@repo/ui/components/ui/skeleton";

export default async function CodeReviewSettingsPage({
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

	// Prefetch repositories to avoid loading state
	prefetch(
		trpc.repository.list.queryOptions({
			includeInactive: false,
			organizationId: access.org.id,
		})
	);

	return (
		<HydrateClient>
			<Suspense fallback={<CodeReviewSettingsSkeleton />}>
				<CodeReviewSettings organizationId={access.org.id} />
			</Suspense>
		</HydrateClient>
	);
}

function CodeReviewSettingsSkeleton() {
	return (
		<div className="space-y-6">
			<div className="rounded-lg border border-border/60 p-6">
				<Skeleton className="h-6 w-48 mb-4" />
				<Skeleton className="h-4 w-full mb-2" />
				<Skeleton className="h-4 w-3/4" />
			</div>
		</div>
	);
}
