import { Suspense } from "react";
import { HydrateClient, prefetch, orgTrpc } from "@repo/console-trpc/server";
import { WorkspaceSearch, WorkspaceSearchSkeleton } from "~/components/workspace-search";

export default async function WorkspaceSearchPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; workspaceName: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const { slug, workspaceName } = await params;
  const { q = "" } = await searchParams;

  // Prefetch workspace's single store (1:1 relationship)
  prefetch(
    orgTrpc.workspace.store.get.queryOptions({
      clerkOrgSlug: slug,
      workspaceName: workspaceName,
    })
  );

  return (
    <div className="flex flex-1 flex-col h-full overflow-auto">
      <HydrateClient>
        <div className="flex flex-col gap-6 py-2 px-6">
          <Suspense fallback={<WorkspaceSearchSkeleton />}>
            <WorkspaceSearch
              orgSlug={slug}
              workspaceName={workspaceName}
              initialQuery={q}
            />
          </Suspense>
        </div>
      </HydrateClient>
    </div>
  );
}
