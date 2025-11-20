import { Suspense } from "react";
import { prefetch, trpc, HydrateClient } from "@repo/console-trpc/server";
import { WorkspacesList } from "~/components/workspaces-list";
import { Skeleton } from "@repo/ui/components/ui/skeleton";

export default async function OrgHomePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  // Prefetch organization to get clerkOrgId
  prefetch(
    trpc.organization.findByClerkOrgSlug.queryOptions({
      clerkOrgSlug: slug,
    }),
  );

  return (
    <HydrateClient>
      <div className="flex flex-1 flex-col h-full overflow-auto">
        <div className="flex flex-col gap-6 p-6">
          <Suspense fallback={<WorkspacesListSkeleton />}>
            <WorkspacesList orgSlug={slug} />
          </Suspense>
        </div>
      </div>
    </HydrateClient>
  );
}

function WorkspacesListSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-10 w-40" />
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="rounded-lg border border-border/60 p-6">
            <Skeleton className="h-16 w-full mb-4" />
            <Skeleton className="h-6 w-32 mb-4" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-24" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
