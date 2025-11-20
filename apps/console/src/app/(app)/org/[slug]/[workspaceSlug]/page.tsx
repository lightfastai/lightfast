import { Suspense } from "react";
import { auth } from "@clerk/nextjs/server";
import {
  WorkspaceDashboard,
  WorkspaceDashboardSkeleton,
} from "~/components/workspace-dashboard";
import { prefetch, HydrateClient } from "@repo/console-trpc/server";

export default async function WorkspacePage({
  params,
}: {
  params: Promise<{ slug: string; workspaceSlug: string }>;
}) {
  const { slug, workspaceSlug } = await params;
  const { orgId: clerkOrgId } = await auth();

  if (!clerkOrgId) {
    throw new Error("Not authenticated");
  }

  // Note: workspace is already prefetched in parent layout
  // We just need the clerkOrgId to pass to the client component which will resolve the workspace

  return (
    <div className="flex flex-1 flex-col h-full overflow-auto">
      <HydrateClient>
        <div className="flex flex-col gap-6 py-2 px-6">
          <Suspense fallback={<WorkspaceDashboardSkeleton />}>
            <WorkspaceDashboard
              orgSlug={slug}
              workspaceSlug={workspaceSlug}
              clerkOrgId={clerkOrgId}
            />
          </Suspense>
        </div>
      </HydrateClient>
    </div>
  );
}
