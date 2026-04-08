import { Skeleton } from "@repo/ui/components/ui/skeleton";

export function RepoIndexConfigLoading() {
  return (
    <div className="rounded-lg border border-border/60 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-start gap-3">
          <Skeleton className="mt-0.5 h-5 w-5 rounded" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-64" />
          </div>
        </div>
        <Skeleton className="h-8 w-20" />
      </div>
    </div>
  );
}
