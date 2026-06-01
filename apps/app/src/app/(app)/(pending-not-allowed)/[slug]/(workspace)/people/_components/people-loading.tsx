import { Skeleton } from "@repo/ui/components/ui/skeleton";

/**
 * Fallback for the `PeopleClient` Suspense boundary. Mirrors the real layout
 * 1:1 so hydration swaps in place with no shift: the toolbar (border-t, py-3,
 * an h-6 filter control and the search field), the table (an h-9 column header
 * and min-h-12 four-column rows), and the count footer.
 */
export function PeopleLoading() {
  return (
    <div className="flex min-h-full flex-col bg-background">
      {/* Toolbar — mirrors PeopleToolbar (filter control + search field) */}
      <div className="flex shrink-0 items-center gap-1.5 border-border/70 border-t px-3 py-3">
        <Skeleton className="size-6 rounded-lg" />
        <div className="ml-auto">
          <Skeleton className="h-6 w-56 rounded-lg" />
        </div>
      </div>

      {/* Table — mirrors PeopleTableView */}
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 overflow-y-auto">
          {/* Column header — mirrors the h-9 header row */}
          <div className="grid h-9 grid-cols-[minmax(0,1.3fr)_minmax(0,1.7fr)_7rem_9rem] items-center gap-3 border-border/70 border-b bg-muted/25 px-4">
            <Skeleton className="h-3 w-12" />
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-3 w-10" />
            <Skeleton className="h-3 w-14" />
          </div>

          {/* Rows — mirror PeopleTableRow (min-h-12, 4-column grid) */}
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

        {/* Footer — mirrors the count row */}
        <div className="flex items-center border-border/70 border-t px-4 py-2.5">
          <Skeleton className="h-3 w-16" />
        </div>
      </div>
    </div>
  );
}
