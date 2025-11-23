import { Suspense } from "react";
import { prefetch, HydrateClient, userTrpc, orgTrpc } from "@repo/console-trpc/server";
import { Skeleton } from "@repo/ui/components/ui/skeleton";
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

  // Prefetch workspace integrations - tRPC procedure will verify org access
  // No blocking access check here - let query handle verification
  prefetch(
    orgTrpc.workspace.integrations.list.queryOptions({
      clerkOrgSlug: slug,
      workspaceName,
    }),
  );

  return (
    <div className="flex flex-1 flex-col h-full overflow-auto">
      <HydrateClient>
        <div className="pt-2 px-6 pb-6">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-2xl font-semibold tracking-tight">Sources</h1>
            <p className="text-sm text-muted-foreground mt-1">
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
                  workspaceName={workspaceName}
                  initialSearch={search}
                  initialStatus={status as "all" | "active" | "inactive"}
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
    </div>
  );
}

function InstalledSourcesSkeleton() {
  return (
    <div className="space-y-4">
      {/* Filter bar skeleton */}
      <div className="flex items-center gap-4">
        <Skeleton className="h-10 w-20" />
        <Skeleton className="h-10 w-32" />
        <Skeleton className="h-10 flex-1" />
        <Skeleton className="h-10 w-48" />
      </div>
      {/* Sources list skeleton */}
      <div className="rounded-lg border border-border/60 overflow-hidden">
        <div className="divide-y divide-border">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 p-4">
              <Skeleton className="h-10 w-10 rounded-lg" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-48" />
              </div>
              <Skeleton className="h-8 w-20" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
