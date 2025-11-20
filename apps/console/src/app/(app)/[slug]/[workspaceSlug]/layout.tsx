import { Suspense } from "react";
import { notFound } from "next/navigation";
import { prefetch, trpc } from "@repo/console-trpc/server";
import { Skeleton } from "@repo/ui/components/ui/skeleton";

interface WorkspaceLayoutProps {
	children: React.ReactNode;
	params: Promise<{ slug: string; workspaceSlug: string }>;
}

/**
 * Workspace layout - prefetches workspace-specific data
 *
 * Hierarchy: Organization > Workspace > Pages
 * Similar to PlanetScale: lightfast > lightfast-chat > Dashboard/Branches/etc
 */
export default async function WorkspaceLayout({
	children,
	params,
}: WorkspaceLayoutProps) {
	const { workspaceSlug } = await params;

	// TODO: Prefetch workspace data once we have the endpoint
	// prefetch(
	//   trpc.workspace.findBySlug.queryOptions({
	//     workspaceSlug,
	//   })
	// );

	// TODO: Prefetch workspace-level data (repositories, jobs, metrics)
	// prefetch(trpc.repository.list.queryOptions({ workspaceSlug }));
	// prefetch(trpc.jobs.list.queryOptions({ workspaceSlug }));

	return (
		<Suspense fallback={<WorkspaceLayoutSkeleton />}>{children}</Suspense>
	);
}

function WorkspaceLayoutSkeleton() {
	return (
		<div className="flex items-center justify-center min-h-[400px]">
			<Skeleton className="h-32 w-96" />
		</div>
	);
}
