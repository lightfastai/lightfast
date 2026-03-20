import { HydrateClient, prefetch, trpc } from "@repo/app-trpc/server";
import { Suspense } from "react";
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
    trpc.workspace.store.get.queryOptions({
      clerkOrgSlug: slug,
      workspaceName,
    })
  );

  return (
    <Suspense fallback={<WorkspaceSearchSkeleton />}>
      <HydrateClient>
        <WorkspaceSearch
          initialQuery={q}
          orgSlug={slug}
          workspaceName={workspaceName}
        />
      </HydrateClient>
    </Suspense>
  );
}
