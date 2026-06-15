import { Skeleton } from "@repo/ui/components/ui/skeleton";

export function SignalsLoading() {
  return (
    <div className="flex min-h-full flex-col border-border/70 border-t bg-background">
      <div className="flex h-14 items-center justify-between border-border/70 border-b px-3">
        <div className="flex items-center gap-2">
          <Skeleton className="size-8 rounded-lg" />
          <Skeleton className="h-8 w-36 rounded-lg" />
          <Skeleton className="h-8 w-32 rounded-lg" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-24 rounded-lg" />
          <Skeleton className="h-8 w-56 rounded-lg" />
          <Skeleton className="size-8 rounded-lg" />
        </div>
      </div>
      <div className="min-h-0 flex-1 px-3 py-3">
        <div className="space-y-1">
          <div className="flex h-11 items-center gap-2 rounded-lg border border-border/70 bg-muted/20 px-4">
            <Skeleton className="size-3.5" />
            <Skeleton className="size-3.5 rounded-full" />
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="h-3.5 w-5" />
          </div>
          {Array.from({ length: 8 }).map((_, index) => (
            <div
              className="grid min-h-12 grid-cols-[2rem_4.5rem_1.25rem_minmax(0,1fr)_8rem] items-center gap-3 rounded-lg px-4"
              key={index}
            >
              <Skeleton className="size-4" />
              <Skeleton className="h-3 w-12" />
              <Skeleton className="size-3.5 rounded-full" />
              <Skeleton className="h-3.5 w-3/4" />
              <Skeleton className="ml-auto h-3 w-20" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
