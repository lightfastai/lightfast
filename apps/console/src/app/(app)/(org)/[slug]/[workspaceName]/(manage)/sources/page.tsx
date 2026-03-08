import { HydrateClient, orgTrpc, prefetch } from "@repo/console-trpc/server";
import { Skeleton } from "@repo/ui/components/ui/skeleton";
import { Suspense } from "react";
import { InstalledSources } from "./_components/installed-sources";
import { LatestIntegrations } from "./_components/latest-integrations";

export default async function SourcesPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; workspaceName: string }>;
  searchParams: Promise<{ search?: string; status?: string }>;
}) {
  const { slug, workspaceName } = await params;
  const { search = "", status = "all" } = await searchParams;

  // Prefetch workspace sources - tRPC procedure will verify org access
  // No blocking access check here - let query handle verification
  prefetch(
    orgTrpc.workspace.sources.list.queryOptions({
      clerkOrgSlug: slug,
      workspaceName,
    })
  );

  return (
    <HydrateClient>
      <div className="pb-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="font-semibold text-2xl tracking-tight">Sources</h1>
          <p className="mt-1 text-muted-foreground text-sm">
            Manage integrations connected to this workspace
          </p>
        </div>

        {/* 12-column grid: 9 cols sources + 3 cols integrations */}
        <div className="grid grid-cols-12 gap-6">
          {/* Left column: Installed sources (9 cols) */}
          <div className="col-span-12 lg:col-span-9">
            <Suspense fallback={<InstalledSourcesSkeleton />}>
              <InstalledSources
                clerkOrgSlug={slug}
                initialSearch={search}
                initialStatus={status as "all" | "active" | "inactive"}
                workspaceName={workspaceName}
              />
            </Suspense>
          </div>

          {/* Right column: Latest integrations (3 cols) */}
          <div className="col-span-12 lg:col-span-3">
            <LatestIntegrations />
          </div>
        </div>
      </div>
    </HydrateClient>
  );
}

function InstalledSourcesSkeleton() {
  return (
    <div className="space-y-4">
      {/* Filter bar skeleton */}
      <div className="flex items-center gap-3">
        <Skeleton className="h-8 flex-1" />
        <Skeleton className="h-8 w-32" />
      </div>
      {/* Provider list skeleton */}
      <div className="w-full divide-y rounded-lg border">
        {Array.from({ length: 3 }).map((_, i) => (
          <div className="flex items-center justify-between px-4 py-3" key={i}>
            <div className="flex items-center gap-3">
              <Skeleton className="h-5 w-5 rounded" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-5 w-20 rounded-full" />
            </div>
            <Skeleton className="h-4 w-4" />
          </div>
        ))}
      </div>
    </div>
  );
}
