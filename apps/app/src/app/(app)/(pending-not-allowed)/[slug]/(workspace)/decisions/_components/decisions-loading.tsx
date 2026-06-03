import { Skeleton } from "@repo/ui/components/ui/skeleton";

const GRID =
  "grid grid-cols-[7.5rem_minmax(0,1.6fr)_minmax(0,1.3fr)_8rem_7rem_5.5rem_2rem] items-center gap-3";

/**
 * Fallback for the `DecisionsClient` Suspense boundary. Mirrors the real layout
 * 1:1 so hydration swaps in place: the toolbar (filter control + search field),
 * the column header, a sticky day header, status-rail rows, and the footer.
 */
export function DecisionsLoading() {
  return (
    <div className="flex min-h-full flex-col bg-background">
      <div className="flex shrink-0 items-center gap-1.5 border-border/70 border-t px-3 py-3">
        <Skeleton className="size-6 rounded-lg" />
        <div className="ml-auto">
          <Skeleton className="h-6 w-56 rounded-lg" />
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div
            className={`${GRID} h-9 border-border/70 border-b border-l-2 border-l-transparent bg-muted/25 px-4`}
          >
            <Skeleton className="h-3 w-12" />
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-3 w-12" />
            <Skeleton className="h-3 w-12" />
            <Skeleton className="h-3 w-12" />
            <Skeleton className="h-3 w-12" />
            <span />
          </div>

          <div className="flex items-center gap-2 border-border/40 border-b px-4 py-1.5">
            <Skeleton className="h-3 w-24" />
          </div>

          {Array.from({ length: 8 }).map((_, index) => (
            <div
              className={`${GRID} min-h-11 border-border/40 border-b border-l-2 border-l-transparent px-4`}
              key={index}
            >
              <Skeleton className="h-3.5 w-16" />
              <Skeleton className="h-3.5 w-44" />
              <Skeleton className="h-3.5 w-28" />
              <Skeleton className="h-5 w-16 rounded-md" />
              <Skeleton className="h-3.5 w-14" />
              <Skeleton className="h-3.5 w-10" />
              <span />
            </div>
          ))}
        </div>

        <div className="flex items-center border-border/70 border-t px-4 py-2.5">
          <Skeleton className="h-3 w-20" />
        </div>
      </div>
    </div>
  );
}
