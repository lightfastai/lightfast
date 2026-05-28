import { Skeleton } from "@repo/ui/components/ui/skeleton";

export function PeopleLoading() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-7 w-28" />
        <Skeleton className="mt-2 h-4 w-72" />
      </div>
      <div className="overflow-hidden rounded-lg border border-border/60">
        {Array.from({ length: 6 }).map((_, index) => (
          <div
            className="grid grid-cols-[minmax(0,1fr)_8rem_8rem_5rem] gap-4 border-border/60 border-b px-4 py-3 last:border-b-0"
            key={index}
          >
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-8" />
          </div>
        ))}
      </div>
    </div>
  );
}
