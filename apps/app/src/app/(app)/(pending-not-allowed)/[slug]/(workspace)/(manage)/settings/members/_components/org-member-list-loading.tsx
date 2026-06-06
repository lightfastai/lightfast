import { Skeleton } from "@repo/ui/components/ui/skeleton";

export function OrgMemberListLoading() {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <Skeleton className="h-5 w-28" />
        <Skeleton className="h-7 w-20 rounded-[9px]" />
      </div>

      <Skeleton className="h-7 w-full rounded-[9px]" />

      <div className="divide-y divide-border rounded-[12px] border border-border bg-background">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            className="flex items-center justify-between gap-4 p-3"
            key={index}
          >
            <div className="flex items-center gap-2.5">
              <Skeleton className="size-9 rounded-[9px]" />
              <div className="space-y-2">
                <Skeleton className="h-3.5 w-36" />
                <Skeleton className="h-3 w-48" />
              </div>
            </div>
            <Skeleton className="h-7 w-24" />
          </div>
        ))}
      </div>
    </section>
  );
}
