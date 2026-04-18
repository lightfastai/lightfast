import { Skeleton } from "@repo/ui/components/ui/skeleton";
import { Suspense } from "react";
import { EventDetailView } from "./_components/event-detail-view";

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;

  return (
    <Suspense fallback={<EventDetailSkeleton />}>
      <EventDetailView eventId={Number(eventId)} />
    </Suspense>
  );
}

function EventDetailSkeleton() {
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
        <Skeleton className="h-48 w-full rounded-lg" />
      </div>
    </div>
  );
}
