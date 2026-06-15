import { cn } from "@repo/ui/lib/utils";
import { formatDuration, formatRelativeTimeToNow } from "@vendor/lib/time";
import { CheckCircle2, ChevronDown, CircleX, Loader2 } from "lucide-react";
import type { ComponentType } from "react";
import { DecisionProviderIcon } from "./decision-provider-icon";
import { DecisionsDetail } from "./decisions-detail";
import {
  type DecisionRow as DecisionRowType,
  type DecisionStatus,
  formatCaller,
  getDecisionProviderLabel,
  getDecisionStatusMeta,
  getSourceLabel,
} from "./decisions-model";

export const ROW_GRID =
  "grid grid-cols-[7.5rem_minmax(0,1.6fr)_minmax(0,1.3fr)_8rem_7rem_5.5rem_2rem] items-center gap-3";

const STATUS_ICONS: Record<
  DecisionStatus,
  ComponentType<{ className?: string }>
> = {
  failed: CircleX,
  running: Loader2,
  succeeded: CheckCircle2,
};

export function DecisionRow({
  decision,
  isExpanded,
  onToggle,
}: {
  decision: DecisionRowType;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const status = getDecisionStatusMeta(decision.status);
  const StatusIcon = STATUS_ICONS[decision.status];
  const durationLabel = decision.finishedAt
    ? formatDuration(
        decision.finishedAt.getTime() - decision.startedAt.getTime()
      )
    : "-";

  return (
    <div
      className={cn(
        "border-border/40 border-b border-l-2",
        status.rail,
        isExpanded && "bg-muted/20"
      )}
    >
      <button
        aria-expanded={isExpanded}
        className={cn(
          ROW_GRID,
          "min-h-11 w-full px-4 text-left hover:bg-muted/30"
        )}
        onClick={onToggle}
        type="button"
      >
        <span className="flex min-w-0 items-center gap-1.5">
          <StatusIcon
            aria-hidden="true"
            className={cn("size-3.5 shrink-0", status.tone)}
          />
          <span className="truncate text-muted-foreground text-xs">
            {status.label}
          </span>
        </span>

        <span className="flex min-w-0 items-center gap-2">
          <DecisionProviderIcon
            className="size-3.5 shrink-0 text-foreground"
            provider={decision.provider}
          />
          <span className="min-w-0 truncate font-mono text-foreground text-sm">
            {getDecisionProviderLabel(decision.provider)} /{" "}
            {decision.providerToolName}
          </span>
        </span>

        <span className="min-w-0 truncate text-muted-foreground text-sm">
          {formatCaller(decision)}
        </span>

        <span className="min-w-0 truncate">
          <span className="inline-flex h-5 items-center rounded-md border border-border/70 bg-muted/25 px-1.5 text-muted-foreground text-xs">
            {getSourceLabel(decision.sourceSurface)}
          </span>
        </span>

        <span
          className="truncate text-muted-foreground text-xs"
          title={decision.startedAt.toISOString()}
        >
          {formatRelativeTimeToNow(decision.startedAt, { addSuffix: true })}
        </span>

        <span className="truncate text-muted-foreground text-xs">
          {durationLabel}
        </span>

        <span className="flex justify-end">
          <ChevronDown
            aria-hidden="true"
            className={cn(
              "size-4 text-muted-foreground transition-transform",
              isExpanded && "rotate-180"
            )}
          />
        </span>
      </button>

      {isExpanded ? <DecisionsDetail decision={decision} /> : null}
    </div>
  );
}
