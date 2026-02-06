import { Suspense } from "react";
import { HydrateClient, prefetch, orgTrpc } from "@repo/console-trpc/server";
import {
  WorkspaceSearch,
  WorkspaceSearchSkeleton,
} from "~/components/workspace-search";

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
    }),
  );

  return (
    <Suspense fallback={<WorkspaceSearchSkeleton />}>
      <HydrateClient>
        <WorkspaceSearch
          orgSlug={slug}
          workspaceName={workspaceName}
          initialQuery={q}
        />
      </HydrateClient>
    </Suspense>
  );
}
