import { Skeleton } from "@repo/ui/components/ui/skeleton";

export default function NewAutomationLoading() {
  return (
    <div className="min-h-full bg-background text-foreground">
      <div
        aria-label="Loading new automation form"
        className="mx-auto w-full max-w-2xl px-6 py-10"
        role="status"
      >
        <Skeleton className="mb-8 h-8 w-20" />

        <div className="space-y-8">
          <div className="space-y-2">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-10 w-full" />
          </div>

          <div className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-48 w-full" />
          </div>

          <div className="space-y-3">
            <div className="space-y-2">
              <Skeleton className="h-4 w-20" />
              <div className="flex gap-2">
                <Skeleton className="h-9 w-16" />
                <Skeleton className="h-9 w-16" />
              </div>
            </div>

            <div className="space-y-2">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-10 w-40" />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Skeleton className="h-10 w-20" />
            <Skeleton className="h-10 w-20" />
          </div>
        </div>
      </div>
    </div>
  );
}
