import { Skeleton } from "@repo/ui/components/ui/skeleton";

export function SignalsLoading() {
  return (
    <div className="min-h-full border-border border-t bg-background">
      {Array.from({ length: 8 }).map((_, index) => (
        <div
          className="grid min-h-11 grid-cols-[2rem_minmax(0,1fr)_5rem_5rem_5rem] items-center gap-3 border-border/70 border-b px-4"
          key={index}
        >
          <Skeleton className="size-3.5 rounded-full" />
          <div className="space-y-1.5">
            <Skeleton className="h-3 w-1/2" />
            <Skeleton className="h-2.5 w-3/4" />
          </div>
          <Skeleton className="h-5 rounded-full" />
          <Skeleton className="h-5 rounded-full" />
          <Skeleton className="h-5 rounded-full" />
        </div>
      ))}
    </div>
  );
}
