import { Skeleton } from "@repo/ui/components/ui/skeleton";
import { Suspense } from "react";
import { JobsTableWrapper } from "~/components/jobs-table";

export default async function JobsPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; workspaceName: string }>;
  searchParams: Promise<{ status?: string; search?: string }>;
}) {
  const { slug, workspaceName } = await params;
  const { status = "all", search = "" } = await searchParams;

  // Parse status filter from URL (validate it's a valid status)
  const validStatuses = [
    "all",
    "queued",
    "running",
    "completed",
    "failed",
    "cancelled",
  ];
  const statusFilter = validStatuses.includes(status) ? status : "all";

  return (
    <div className="pb-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="font-semibold text-2xl tracking-tight">Jobs</h1>
        <p className="mt-1 text-muted-foreground text-sm">
          Track workflow executions and background tasks for this workspace
        </p>
      </div>

      {/* Content */}
      <div>
        <Suspense fallback={<JobsPageSkeleton />}>
          <JobsTableWrapper
            clerkOrgSlug={slug}
            initialSearch={search}
            initialStatus={statusFilter}
            workspaceName={workspaceName}
          />
        </Suspense>
      </div>
    </div>
  );
}

function JobsPageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-border/60 p-6">
        <div className="mb-6 flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-96" />
          </div>
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="space-y-3">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      </div>
    </div>
  );
}
