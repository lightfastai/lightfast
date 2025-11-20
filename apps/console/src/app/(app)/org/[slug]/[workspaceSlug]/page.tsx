import { Suspense } from "react";
import {
  WorkspaceDashboard,
  WorkspaceDashboardSkeleton,
} from "~/components/workspace-dashboard";
import { HydrateClient } from "@repo/console-trpc/server";

export default async function WorkspacePage({
  params,
}: {
  params: Promise<{ slug: string; workspaceSlug: string }>;
}) {
  const { slug, workspaceSlug } = await params;

  // No blocking access check - WorkspaceDashboard will use slug to resolve org
  // This ensures we always use the org from URL, not from potentially stale auth() state

  return (
    <div className="flex flex-1 flex-col h-full overflow-auto">
      <HydrateClient>
        <div className="flex flex-col gap-6 py-2 px-6">
          <Suspense fallback={<WorkspaceDashboardSkeleton />}>
            <WorkspaceDashboard
              orgSlug={slug}
              workspaceSlug={workspaceSlug}
            />
          </Suspense>
        </div>
      </HydrateClient>
    </div>
  );
}
