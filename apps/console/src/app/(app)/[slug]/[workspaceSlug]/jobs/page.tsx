import { Suspense } from "react";
import { JobsTableWrapper } from "~/components/jobs-table";
import { Skeleton } from "@repo/ui/components/ui/skeleton";
import { AppBreadcrumb } from "~/components/app-breadcrumb";
import { HydrateClient } from "@repo/console-trpc/server";

export default async function JobsPage({
	params,
}: {
	params: Promise<{ slug: string; workspaceSlug: string }>;
}) {
	const { slug, workspaceSlug } = await params;

	// No blocking access check - JobsTableWrapper queries will verify access
	// workspace resolution and job prefetching happen in JobsTableWrapper

	return (
		<div className="flex flex-1 flex-col h-full overflow-auto">
			<HydrateClient>
				<div className="flex flex-col gap-6 p-6">
					<AppBreadcrumb
						items={[
							{ label: slug, href: `/${slug}` },
							{ label: workspaceSlug, href: `/${slug}/${workspaceSlug}` },
							{ label: "Jobs" },
						]}
					/>
					<div className="flex flex-col gap-6">
						<div>
							<h1 className="text-2xl font-semibold tracking-tight">Jobs</h1>
							<p className="text-sm text-muted-foreground mt-1">
								Track workflow executions and background tasks for this workspace
							</p>
						</div>
						<Suspense fallback={<JobsPageSkeleton />}>
							<JobsTableWrapper clerkOrgSlug={slug} workspaceSlug={workspaceSlug} />
						</Suspense>
					</div>
				</div>
			</HydrateClient>
		</div>
	);
}

function JobsPageSkeleton() {
	return (
		<div className="space-y-6">
			<div className="rounded-lg border border-border/60 p-6">
				<div className="flex items-center justify-between mb-6">
					<div className="space-y-2">
						<Skeleton className="h-8 w-48" />
						<Skeleton className="h-4 w-96" />
					</div>
					<Skeleton className="h-10 w-32" />
				</div>
				<div className="space-y-3">
					<Skeleton className="h-12 w-full" />
					<Skeleton className="h-16 w-full" />
					<Skeleton className="h-16 w-full" />
					<Skeleton className="h-16 w-full" />
				</div>
			</div>
		</div>
	);
}
