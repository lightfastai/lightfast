import { Skeleton } from "@repo/ui/components/ui/skeleton";

export function OrgMemberListLoading() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Skeleton className="h-8 flex-1" />
        <Skeleton className="h-8 w-20" />
      </div>

      <div className="overflow-hidden rounded-lg border border-border/60">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            className="flex items-center justify-between border-border/60 border-b px-4 py-3 last:border-b-0"
            key={index}
          >
            <div className="flex items-center gap-3">
              <Skeleton className="size-9 rounded-full" />
              <div className="space-y-2">
                <Skeleton className="h-3.5 w-36" />
                <Skeleton className="h-3 w-48" />
              </div>
            </div>
            <Skeleton className="h-7 w-24" />
          </div>
        ))}
      </div>
    </div>
  );
}
