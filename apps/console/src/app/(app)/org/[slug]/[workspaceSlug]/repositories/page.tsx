import { notFound } from "next/navigation";
import { Suspense } from "react";
import { auth } from "@clerk/nextjs/server";
import { RepositoriesSettings } from "~/components/repositories-settings";
import { prefetch, trpc } from "@repo/console-trpc/server";
import { Skeleton } from "@repo/ui/components/ui/skeleton";
import { AppBreadcrumb } from "~/components/app-breadcrumb";

export default async function RepositoriesPage({
	params,
}: {
	params: Promise<{ slug: string; workspaceSlug: string }>;
}) {
	const { slug, workspaceSlug } = await params;
	const { orgId } = await auth();
	if (!orgId) {
		notFound();
	}

	// Prefetch repositories for this workspace
	// TODO: Update to filter by workspaceSlug when backend supports it
	prefetch(
		trpc.repository.list.queryOptions({
			includeInactive: false,
			clerkOrgId: orgId,
		})
	);

	return (
		<div className="flex flex-1 flex-col h-full overflow-auto">
			<div className="flex flex-col gap-6 p-6">
				<AppBreadcrumb
					items={[
						{ label: slug, href: `/org/${slug}` },
						{ label: workspaceSlug, href: `/org/${slug}/${workspaceSlug}` },
						{ label: "Repositories" },
					]}
				/>
				<div className="flex flex-col gap-6">
					<div>
						<h1 className="text-2xl font-semibold tracking-tight">Repositories</h1>
						<p className="text-sm text-muted-foreground mt-1">
							Manage GitHub repositories connected to this workspace
						</p>
					</div>
					<Suspense fallback={<RepositoriesSettingsSkeleton />}>
						<RepositoriesSettings />
					</Suspense>
				</div>
			</div>
		</div>
	);
}

function RepositoriesSettingsSkeleton() {
	return (
		<div className="space-y-6">
			<div className="flex items-center justify-between gap-4">
				<Skeleton className="h-10 w-64" />
				<Skeleton className="h-10 w-40" />
			</div>
			<div className="rounded-lg border border-border/60 p-6">
				<div className="space-y-3">
					<Skeleton className="h-16 w-full" />
					<Skeleton className="h-16 w-full" />
					<Skeleton className="h-16 w-full" />
				</div>
			</div>
		</div>
	);
}
