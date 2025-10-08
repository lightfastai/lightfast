import { redirect, notFound } from "next/navigation";
import { Suspense } from "react";
import { auth } from "@clerk/nextjs/server";
import { CodeReviewSettings } from "~/components/code-review-settings";
import { verifyOrgAccess } from "~/lib/org-access";
import { prefetch, trpc } from "@repo/deus-trpc/server";
import { Skeleton } from "@repo/ui/components/ui/skeleton";

export default async function CodeReviewSettingsPage({
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
		<Suspense fallback={<CodeReviewSettingsSkeleton />}>
			<CodeReviewSettings organizationId={access.org.id} />
		</Suspense>
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
