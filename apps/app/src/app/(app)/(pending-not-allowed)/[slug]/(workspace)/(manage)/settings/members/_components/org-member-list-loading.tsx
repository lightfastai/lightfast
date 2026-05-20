import { Skeleton } from "@repo/ui/components/ui/skeleton";

export function OrgMemberListLoading() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 3 }).map((_, index) => (
        <div
          className="flex items-center justify-between rounded-lg border border-border/60 px-4 py-4"
          key={index}
        >
          <div className="flex items-center gap-3">
            <Skeleton className="size-9 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-3 w-48" />
            </div>
          </div>
          <Skeleton className="h-8 w-24" />
        </div>
      ))}
    </div>
  );
}
