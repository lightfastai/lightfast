import { HydrateClient, prefetch, trpc } from "@repo/console-trpc/server";

type JobStatus = "queued" | "running" | "completed" | "failed" | "cancelled";

export default async function JobsLayout({
	params,
	children,
}: {
	params: Promise<{ slug: string; workspaceName: string }>;
	children: React.ReactNode;
}) {
	const { slug, workspaceName } = await params;

	// Prefetch jobs for all common status filters
	// This prevents loading skeletons when switching between tabs
	const statusFilters: (JobStatus | undefined)[] = [
		undefined, // "all"
		"running",
		"completed",
		"failed",
	];

	for (const status of statusFilters) {
		prefetch(
			trpc.jobs.list.queryOptions({
				clerkOrgSlug: slug,
				workspaceName,
				status,
				limit: 50,
			})
		);
	}

	return <HydrateClient>{children}</HydrateClient>;
}
