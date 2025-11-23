import { Suspense } from "react";
import {
  WorkspaceDashboard,
  WorkspaceDashboardSkeleton,
} from "~/components/workspace-dashboard";
import { HydrateClient, trpc, prefetch } from "@repo/console-trpc/server";

export default async function WorkspacePage({
  params,
}: {
  params: Promise<{ slug: string; workspaceName: string }>;
}) {
  const { slug, workspaceName } = await params;

  // No blocking access check - WorkspaceDashboard will use slug to resolve org
  // This ensures we always use the org from URL, not from potentially stale auth() state

  // Prefetch all 8 queries in parallel on the server (granular for better caching)
  prefetch(
    trpc.workspace.sources.list.queryOptions({
      clerkOrgSlug: slug,
      workspaceName: workspaceName,
    })
  );
  prefetch(
    trpc.workspace.stores.list.queryOptions({
      clerkOrgSlug: slug,
      workspaceName: workspaceName,
    })
  );
  prefetch(
    trpc.workspace.documents.stats.queryOptions({
      clerkOrgSlug: slug,
      workspaceName: workspaceName,
    })
  );
  prefetch(
    trpc.workspace.jobs.stats.queryOptions({
      clerkOrgSlug: slug,
      workspaceName: workspaceName,
    })
  );
  prefetch(
    trpc.workspace.jobs.recent.queryOptions({
      clerkOrgSlug: slug,
      workspaceName: workspaceName,
    })
  );
  prefetch(
    trpc.workspace.jobPercentiles.queryOptions({
      clerkOrgSlug: slug,
      workspaceName: workspaceName,
      timeRange: "24h",
    })
  );
  prefetch(
    trpc.workspace.performanceTimeSeries.queryOptions({
      clerkOrgSlug: slug,
      workspaceName: workspaceName,
      timeRange: "24h",
    })
  );
  prefetch(
    trpc.workspace.health.overview.queryOptions({
      clerkOrgSlug: slug,
      workspaceName: workspaceName,
    })
  );

  return (
    <div className="flex flex-1 flex-col h-full overflow-auto">
      <HydrateClient>
        <div className="flex flex-col gap-6 py-2 px-6">
          <Suspense fallback={<WorkspaceDashboardSkeleton />}>
            <WorkspaceDashboard
              orgSlug={slug}
              workspaceName={workspaceName}
            />
          </Suspense>
        </div>
      </HydrateClient>
    </div>
  );
}
