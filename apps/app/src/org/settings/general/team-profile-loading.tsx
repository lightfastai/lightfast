import { Skeleton } from "@repo/ui/components/ui/skeleton";

export function TeamProfileLoading() {
  return (
    <section>
      <Skeleton className="h-5 w-20" />
      <div className="mt-2 divide-y divide-border/55">
        <div className="flex items-center justify-between gap-6 py-4">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="size-7 rounded-md" />
        </div>
        <div className="flex items-center justify-between gap-6 py-4">
          <div className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-3 w-72" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-8 w-14" />
          </div>
        </div>
      </div>
    </section>
  );
}
