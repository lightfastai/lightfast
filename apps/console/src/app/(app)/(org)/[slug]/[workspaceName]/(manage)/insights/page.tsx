import { Suspense } from "react";
import {
  WorkspaceDashboard,
  WorkspaceDashboardSkeleton,
} from "~/components/workspace-dashboard";
import { HydrateClient, prefetch, orgTrpc } from "@repo/console-trpc/server";

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
    orgTrpc.workspace.sources.list.queryOptions({
      clerkOrgSlug: slug,
      workspaceName: workspaceName,
    })
  );
  prefetch(
    orgTrpc.workspace.store.get.queryOptions({
      clerkOrgSlug: slug,
      workspaceName: workspaceName,
    })
  );
  prefetch(
    orgTrpc.workspace.documents.stats.queryOptions({
      clerkOrgSlug: slug,
      workspaceName: workspaceName,
    })
  );
  prefetch(
    orgTrpc.workspace.jobs.stats.queryOptions({
      clerkOrgSlug: slug,
      workspaceName: workspaceName,
    })
  );
  prefetch(
    orgTrpc.workspace.jobs.recent.queryOptions({
      clerkOrgSlug: slug,
      workspaceName: workspaceName,
    })
  );
  prefetch(
    orgTrpc.workspace.jobPercentiles.queryOptions({
      clerkOrgSlug: slug,
      workspaceName: workspaceName,
      timeRange: "24h",
    })
  );
  prefetch(
    orgTrpc.workspace.performanceTimeSeries.queryOptions({
      clerkOrgSlug: slug,
      workspaceName: workspaceName,
      timeRange: "24h",
    })
  );
  prefetch(
    orgTrpc.workspace.health.overview.queryOptions({
      clerkOrgSlug: slug,
      workspaceName: workspaceName,
    })
  );

  return (
    <HydrateClient>
      <div className="flex flex-col gap-6">
        <Suspense fallback={<WorkspaceDashboardSkeleton />}>
          <WorkspaceDashboard
            orgSlug={slug}
            workspaceName={workspaceName}
          />
        </Suspense>
      </div>
    </HydrateClient>
  );
}
