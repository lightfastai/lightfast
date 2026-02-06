import { Suspense } from "react";
import { JobsTableWrapper } from "~/components/jobs-table";
import { Skeleton } from "@repo/ui/components/ui/skeleton";

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
        <h1 className="text-2xl font-semibold tracking-tight">Jobs</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Track workflow executions and background tasks for this workspace
        </p>
      </div>

      {/* Content */}
      <div>
        <Suspense fallback={<JobsPageSkeleton />}>
          <JobsTableWrapper
            clerkOrgSlug={slug}
            workspaceName={workspaceName}
            initialStatus={statusFilter}
            initialSearch={search}
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
        <div className="flex items-center justify-between mb-6">
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
