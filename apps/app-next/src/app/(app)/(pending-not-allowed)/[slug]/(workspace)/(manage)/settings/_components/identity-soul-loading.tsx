import { Skeleton } from "@repo/ui/components/ui/skeleton";

const ROWS = ["IDENTITY.md", "SOUL.md"];

export function IdentitySoulLoading() {
  return (
    <section>
      <Skeleton className="h-5 w-32" />
      <div className="mt-4 divide-y divide-border rounded-[12px] border border-border bg-background">
        {ROWS.map((row) => (
          <div
            className="flex items-center justify-between gap-4 p-3"
            key={row}
          >
            <div className="flex min-w-0 items-center gap-2.5">
              <Skeleton className="size-9 rounded-[9px]" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-40" />
              </div>
            </div>
            <Skeleton className="h-6 w-24 rounded-full" />
          </div>
        ))}
      </div>
    </section>
  );
}
