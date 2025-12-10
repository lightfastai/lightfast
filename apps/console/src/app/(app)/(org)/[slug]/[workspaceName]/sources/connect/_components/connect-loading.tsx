import { Skeleton } from "@repo/ui/components/ui/skeleton";

export function ConnectLoading() {
  return (
    <div className="space-y-8">
      {/* Section 1: Provider Selection */}
      <div className="flex gap-6">
        <Skeleton className="h-8 w-8 rounded-full" />
        <div className="flex-1 space-y-4">
          <Skeleton className="h-6 w-32" />
          <div className="flex gap-4">
            <Skeleton className="h-24 w-40" />
            <Skeleton className="h-24 w-40" />
            <Skeleton className="h-24 w-40" />
          </div>
        </div>
      </div>

      {/* Section 2: Connect Account */}
      <div className="flex gap-6">
        <Skeleton className="h-8 w-8 rounded-full" />
        <div className="flex-1 space-y-4">
          <Skeleton className="h-6 w-36" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>

      {/* Section 3: Select Resources */}
      <div className="flex gap-6">
        <Skeleton className="h-8 w-8 rounded-full" />
        <div className="flex-1 space-y-4">
          <Skeleton className="h-6 w-36" />
          <Skeleton className="h-48 w-full" />
        </div>
      </div>
    </div>
  );
}
