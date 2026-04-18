import { Skeleton } from "@repo/ui/components/ui/skeleton";
import { Suspense } from "react";
import { EntityDetailView } from "./_components/entity-detail-view";

export default async function EntityDetailPage({
  params,
}: {
  params: Promise<{ entityId: string }>;
}) {
  const { entityId } = await params;

  return (
    <Suspense fallback={<EntityDetailSkeleton />}>
      <EntityDetailView entityId={entityId} />
    </Suspense>
  );
}

function EntityDetailSkeleton() {
  return (
    <div className="space-y-6 pb-6">
      <Skeleton className="h-4 w-20" />
      <div className="space-y-2">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-48" />
      </div>
      <div className="space-y-3">
        <Skeleton className="h-6 w-20" />
        <div className="overflow-hidden rounded-lg border border-border/60">
          {Array.from({ length: 5 }, (_, i) => (
            <div className="border-border/60 border-b px-4 py-3" key={i}>
              <div className="flex items-start gap-3">
                <Skeleton className="mt-0.5 h-5 w-5 rounded" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/3" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
