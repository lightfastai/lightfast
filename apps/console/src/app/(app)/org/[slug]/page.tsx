import { Suspense } from "react";
import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { OrgChatInterface } from "~/components/org-chat-interface";
import { prefetch, trpc } from "@repo/console-trpc/server";
import { Skeleton } from "@repo/ui/components/ui/skeleton";

export default async function OrgHomePage({
	params,
}: {
	params: Promise<{ slug: string }>;
}) {
	const { slug } = await params;
	const { userId, orgId } = await auth();

	// Simple auth check - middleware already protected via auth.protect()
	// Layout already prefetched org data
	if (!userId || !orgId) {
		redirect("/sign-in");
	}

	// Prefetch page-specific data using orgId from middleware
	// This is the only data fetch needed - org data comes from layout
	prefetch(
		trpc.repository.list.queryOptions({
			includeInactive: false,
			organizationId: orgId,
		})
	);

	// Layout already wraps in HydrateClient and ErrorBoundary
	return (
		<Suspense fallback={<OrgHomeSkeleton />}>
			<OrgChatInterface orgSlug={slug} />
		</Suspense>
	);
}

function OrgHomeSkeleton() {
	return (
		<div className="flex min-h-screen flex-col bg-background text-foreground">
			<main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center px-4 pb-16 pt-20">
				<div className="mb-12 w-full text-center">
					<Skeleton className="h-10 w-96 mx-auto" />
				</div>
				<Skeleton className="w-full max-w-4xl h-64 rounded-2xl" />
			</main>
		</div>
	);
}
