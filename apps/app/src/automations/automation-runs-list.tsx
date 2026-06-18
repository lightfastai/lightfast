import type { AppRouterOutputs } from "@api/app";
import {
  CheckmarkCircle02Icon as CheckCircle,
  ChevronRightIcon as ChevronRight,
  Clock01Icon as Clock,
  Loading03Icon as Loader2,
  CancelCircleIcon as XCircle,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
import { cn } from "@repo/ui/lib/utils";
import { formatRelativeTimeToNow } from "@vendor/lib/time";

type AutomationRun =
  AppRouterOutputs["org"]["workspace"]["automations"]["listRuns"][number];

const RUN_STATUS_ICONS: Record<
  AutomationRun["status"],
  { icon: IconSvgElement; className: string }
> = {
  completed: { icon: CheckCircle, className: "text-emerald-500" },
  failed: { icon: XCircle, className: "text-destructive" },
  cancelled: { icon: XCircle, className: "text-destructive" },
  running: { icon: Loader2, className: "animate-spin text-muted-foreground" },
  pending: { icon: Clock, className: "text-muted-foreground" },
  skipped: { icon: Clock, className: "text-muted-foreground" },
};

function RunRow({
  onSelect,
  run,
  selected,
}: {
  onSelect: (publicId: string) => void;
  run: AutomationRun;
  selected: boolean;
}) {
  const { icon, className } = RUN_STATUS_ICONS[run.status];

  return (
    <button
      className={cn(
        "group flex w-full items-center gap-2 rounded px-1 py-1 text-left transition-colors hover:bg-accent/50",
        selected && "bg-accent"
      )}
      onClick={() => onSelect(run.publicId)}
      type="button"
    >
      <HugeiconsIcon className={`size-3.5 shrink-0 ${className}`} icon={icon} />
      <span className="text-foreground text-sm capitalize">{run.status}</span>
      <span className="ml-auto text-muted-foreground text-xs capitalize">
        {run.trigger}
      </span>
      <span className="text-muted-foreground text-xs">
        {run.createdAt ? formatRelativeTimeToNow(run.createdAt) : "-"}
      </span>
      <HugeiconsIcon
        aria-hidden="true"
        className={cn(
          "size-3.5 shrink-0 text-muted-foreground transition-opacity",
          selected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
        )}
        icon={ChevronRight}
      />
    </button>
  );
}

export function AutomationRunsList({
  onSelectRun,
  runs,
  selectedRunId,
}: {
  onSelectRun: (publicId: string) => void;
  runs: AutomationRun[];
  selectedRunId: string | null;
}) {
  if (runs.length === 0) {
    return <p className="text-muted-foreground text-sm">No runs yet.</p>;
  }

  return (
    <div className="space-y-0.5">
      {runs.map((run) => (
        <RunRow
          key={run.publicId}
          onSelect={onSelectRun}
          run={run}
          selected={run.publicId === selectedRunId}
        />
      ))}
    </div>
  );
}
