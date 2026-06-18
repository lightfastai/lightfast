import type { AppRouterOutputs } from "@api/app";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import { cn } from "@repo/ui/lib/utils";
import { formatDuration, formatRelativeTimeToNow } from "@vendor/lib/time";
import {
  Activity01Icon as Activity,
  CheckmarkCircle02Icon as CheckCircle2,
  Clock01Icon as Clock,
  HashIcon as Hash,
  Link02Icon as Link2,
  PlayIcon as Play,
  Timer01Icon as Timer,
  ZapIcon as Zap,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { ReactNode } from "react";
import {
  AutomationRunAiOutputView,
  isAutomationRunAiOutput,
} from "./automation-run-ai-output";

type AutomationRun =
  AppRouterOutputs["org"]["workspace"]["automations"]["getRun"];
type RunStatus = AutomationRun["status"];

const STATUS_TEXT: Record<RunStatus, string> = {
  completed: "text-emerald-500",
  failed: "text-destructive",
  cancelled: "text-destructive",
  running: "text-foreground",
  pending: "text-muted-foreground",
  skipped: "text-muted-foreground",
};

function formatDateTime(date: Date | null | undefined): string {
  if (!date) {
    return "-";
  }
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "medium",
  }).format(date);
}

function runDuration(run: AutomationRun): string {
  if (!(run.startedAt && run.finishedAt)) {
    return "-";
  }
  return formatDuration(run.finishedAt.getTime() - run.startedAt.getTime());
}

function PropertyRow({
  children,
  icon,
  label,
}: {
  children: ReactNode;
  icon: ReactNode;
  label: string;
}) {
  return (
    <div className="flex items-start gap-3 py-2">
      <span className="flex w-32 shrink-0 items-center gap-2.5 text-muted-foreground text-sm">
        {icon}
        {label}
      </span>
      <div className="min-w-0 flex-1 break-words text-foreground text-sm">
        {children}
      </div>
    </div>
  );
}

export function AutomationRunDetailContent({
  closeSlot,
  onCopyLink,
  run,
}: {
  closeSlot?: ReactNode;
  onCopyLink: () => void;
  run: AutomationRun;
}) {
  const iconClass = "size-4 shrink-0";
  const hasError = !!run.errorMessage || !!run.errorCode;
  const hasOutput = run.output !== null && run.output !== undefined;
  const createdAt = new Date(run.createdAt);
  const updatedAt = new Date(run.updatedAt);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-2.5 px-5 pt-5">
        <Badge
          className={cn("gap-1.5 capitalize", STATUS_TEXT[run.status])}
          variant="outline"
        >
          <span
            aria-hidden="true"
            className="size-1.5 rounded-full bg-current"
          />
          {run.status}
        </Badge>
        <Badge className="text-muted-foreground capitalize" variant="outline">
          {run.trigger}
        </Badge>
        <div className="ml-auto flex items-center gap-1">
          <Button
            aria-label="Copy link"
            className="size-7 rounded-full text-muted-foreground hover:text-foreground"
            onClick={onCopyLink}
            size="icon-sm"
            type="button"
            variant="ghost"
          >
            <HugeiconsIcon icon={Link2} aria-hidden="true" className="size-4" />
          </Button>
          {closeSlot}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5">
        <h2 className="pt-4 pb-5 font-semibold text-2xl text-foreground capitalize leading-tight tracking-tight">
          {run.trigger} run
        </h2>

        <div className="flex flex-col">
          <PropertyRow icon={<HugeiconsIcon icon={Activity} className={iconClass} />} label="Status">
            <span className={cn("capitalize", STATUS_TEXT[run.status])}>
              {run.status}
            </span>
          </PropertyRow>
          <PropertyRow icon={<HugeiconsIcon icon={Zap} className={iconClass} />} label="Trigger">
            <span className="capitalize">{run.trigger}</span>
          </PropertyRow>
          <PropertyRow icon={<HugeiconsIcon icon={Clock} className={iconClass} />} label="Queued">
            <span suppressHydrationWarning>{formatDateTime(createdAt)}</span>
          </PropertyRow>
          <PropertyRow icon={<HugeiconsIcon icon={Play} className={iconClass} />} label="Started">
            <span suppressHydrationWarning>
              {formatDateTime(run.startedAt)}
            </span>
          </PropertyRow>
          <PropertyRow
            icon={<HugeiconsIcon icon={CheckCircle2} className={iconClass} />}
            label="Finished"
          >
            <span suppressHydrationWarning>
              {formatDateTime(run.finishedAt)}
            </span>
          </PropertyRow>
          <PropertyRow icon={<HugeiconsIcon icon={Timer} className={iconClass} />} label="Duration">
            {runDuration(run)}
          </PropertyRow>
          <PropertyRow icon={<HugeiconsIcon icon={Hash} className={iconClass} />} label="Schedule">
            <span className="font-mono text-muted-foreground">
              v{run.scheduleVersion}
            </span>
          </PropertyRow>
          <PropertyRow icon={<HugeiconsIcon icon={Hash} className={iconClass} />} label="Run ID">
            <span className="font-mono text-muted-foreground text-xs">
              {run.publicId}
            </span>
          </PropertyRow>
        </div>

        <div className="my-6 border-border/60 border-t" />

        {hasError ? (
          <div className="space-y-1.5">
            <h3 className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
              Error
            </h3>
            <div className="space-y-1 rounded-md border border-destructive/25 bg-destructive/5 px-3 py-2.5 text-destructive text-sm">
              {run.errorCode ? (
                <p className="font-mono text-xs">{run.errorCode}</p>
              ) : null}
              {run.errorMessage ? <p>{run.errorMessage}</p> : null}
            </div>
          </div>
        ) : (
          <div className="space-y-1.5">
            <h3 className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
              Output
            </h3>
            {hasOutput ? (
              isAutomationRunAiOutput(run.output) ? (
                <AutomationRunAiOutputView output={run.output} />
              ) : (
                <pre className="overflow-x-auto whitespace-pre-wrap break-words rounded-md border border-border/60 bg-muted/30 px-3 py-2.5 font-mono text-foreground text-xs leading-relaxed">
                  {JSON.stringify(run.output, null, 2)}
                </pre>
              )
            ) : (
              <p className="text-muted-foreground text-sm">
                No output captured.
              </p>
            )}
          </div>
        )}
      </div>

      <div className="border-border/60 border-t px-5 py-3.5 text-muted-foreground text-xs">
        <span title={createdAt.toISOString()}>
          Created {formatRelativeTimeToNow(createdAt, { addSuffix: true })}
        </span>
        <span aria-hidden="true"> - </span>
        <span title={updatedAt.toISOString()}>
          Updated {formatRelativeTimeToNow(updatedAt, { addSuffix: true })}
        </span>
      </div>
    </div>
  );
}
