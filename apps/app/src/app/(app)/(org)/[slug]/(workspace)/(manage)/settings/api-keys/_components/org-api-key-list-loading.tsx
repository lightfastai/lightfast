import { Skeleton } from "@repo/ui/components/ui/skeleton";

export function OrgApiKeyListLoading() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-9 w-32" />
      </div>
      <div className="overflow-hidden rounded-lg border border-border/60">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            className="flex items-center justify-between border-border/60 border-b px-4 py-4 last:border-b-0"
            key={i}
          >
            <div className="space-y-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-56" />
            </div>
            <Skeleton className="h-8 w-8" />
          </div>
        ))}
      </div>
    </div>
  );
}
