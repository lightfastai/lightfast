import { Skeleton } from "@repo/ui/components/ui/skeleton";
import { WorkspaceSurface } from "~/components/workspace-surface";

export function SkillsLoading() {
  return (
    <WorkspaceSurface className="overflow-y-auto bg-background" variant="flush">
      <div className="mx-auto w-full max-w-3xl px-6 py-10">
        <div className="flex flex-col items-center pt-6">
          <Skeleton className="h-8 w-80 max-w-full rounded-md" />
          <Skeleton className="mt-3 h-4 w-96 max-w-full rounded-md" />
        </div>

        <div className="mt-10 flex items-center gap-3">
          <Skeleton className="h-7 flex-1 rounded-[9px]" />
          <Skeleton className="h-7 w-32 rounded-[9px]" />
        </div>

        <div className="mt-9 border-border border-b pb-2.5">
          <Skeleton className="h-4 w-16 rounded-md" />
        </div>

        <div className="mt-1 grid grid-cols-1 gap-x-2 sm:grid-cols-2">
          {Array.from({ length: 8 }).map((_, index) => (
            <div className="flex items-center gap-3 px-2.5 py-3" key={index}>
              <Skeleton className="size-9 rounded-[9px]" />
              <div className="min-w-0 flex-1">
                <Skeleton className="h-3.5 w-28 rounded-md" />
                <Skeleton className="mt-2 h-3 w-40 rounded-md" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </WorkspaceSurface>
  );
}
