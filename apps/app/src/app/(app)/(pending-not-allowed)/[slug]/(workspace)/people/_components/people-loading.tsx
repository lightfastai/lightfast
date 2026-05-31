import { Skeleton } from "@repo/ui/components/ui/skeleton";

export function PeopleLoading() {
  return (
    <div className="flex min-h-full flex-col bg-background">
      <div className="flex min-h-10 items-center gap-1.5 border-border/70 border-t px-3 py-1">
        <Skeleton className="size-6 rounded-lg" />
        <div className="ml-auto">
          <Skeleton className="size-6 rounded-lg" />
        </div>
      </div>
      <div className="grid h-9 grid-cols-[minmax(0,1.3fr)_minmax(0,1.7fr)_7rem_9rem] items-center gap-3 border-border/60 border-b bg-muted/20 px-4">
        <Skeleton className="h-3 w-12" />
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-3 w-10" />
        <Skeleton className="h-3 w-14" />
      </div>
      {Array.from({ length: 8 }).map((_, index) => (
        <div
          className="grid min-h-12 grid-cols-[minmax(0,1.3fr)_minmax(0,1.7fr)_7rem_9rem] items-center gap-3 border-border/40 border-b px-4"
          key={index}
        >
          <Skeleton className="h-3.5 w-40" />
          <Skeleton className="h-3.5 w-56" />
          <Skeleton className="h-3.5 w-16" />
          <Skeleton className="h-6 w-20 rounded-md" />
        </div>
      ))}
    </div>
  );
}
