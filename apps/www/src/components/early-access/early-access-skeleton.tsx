import { Skeleton } from "@repo/ui/components/ui/skeleton";

export function EarlyAccessSkeleton() {
  return (
    <div className="grid w-full grid-cols-12 items-start space-x-2">
      <div className="col-span-9">
        <Skeleton className="h-9 w-full" />
      </div>
      <div className="col-span-3">
        <Skeleton className="h-9 w-full" />
      </div>
    </div>
  );
}
