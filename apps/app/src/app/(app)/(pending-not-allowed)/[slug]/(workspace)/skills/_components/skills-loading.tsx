import { Skeleton } from "@repo/ui/components/ui/skeleton";
import { WorkspaceSurface } from "~/components/workspace-surface";

export function SkillsLoading() {
  return (
    <WorkspaceSurface
      className="flex min-h-full flex-col bg-background"
      variant="flush"
    >
      <div className="border-border/70 border-b px-6 py-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <Skeleton className="h-6 w-24" />
            <Skeleton className="mt-2 h-5 w-36 rounded-md" />
          </div>
          <Skeleton className="h-8 w-32 rounded-md" />
        </div>
        <div className="mt-4 flex items-center gap-3">
          <Skeleton className="h-9 w-80 rounded-md" />
          <Skeleton className="h-8 w-56 rounded-md" />
        </div>
      </div>
      {Array.from({ length: 5 }).map((_, index) => (
        <div className="border-border/70 border-b px-6 py-4" key={index}>
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <Skeleton className="h-5 w-44" />
              <Skeleton className="mt-2 h-4 w-2/3" />
              <Skeleton className="mt-3 h-3 w-1/2" />
            </div>
            <Skeleton className="h-8 w-24 rounded-md" />
          </div>
        </div>
      ))}
    </WorkspaceSurface>
  );
}
