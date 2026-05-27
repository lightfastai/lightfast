"use client";

import type { AppRouterOutputs } from "@api/app";
import { useSuspenseQuery } from "@tanstack/react-query";
import { formatRelativeTimeToNow } from "@vendor/lib/time";
import { CheckCircle, Clock, Loader2, XCircle } from "lucide-react";
import { useState } from "react";
import { useTRPC } from "~/trpc/react";

type AutomationRun =
  AppRouterOutputs["org"]["workspace"]["automations"]["listRuns"][number];

const RUN_STATUS_ICONS: Record<
  AutomationRun["status"],
  { icon: React.ElementType; className: string }
> = {
  completed: { icon: CheckCircle, className: "text-emerald-500" },
  failed: { icon: XCircle, className: "text-destructive" },
  cancelled: { icon: XCircle, className: "text-destructive" },
  running: { icon: Loader2, className: "animate-spin text-muted-foreground" },
  pending: { icon: Clock, className: "text-muted-foreground" },
  skipped: { icon: Clock, className: "text-muted-foreground" },
};

function RailSection({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border-border border-t pt-4">
      <p className="mb-2 font-medium text-muted-foreground text-xs uppercase tracking-wide">
        {label}
      </p>
      {children}
    </div>
  );
}

function RunRow({ run }: { run: AutomationRun }) {
  const [expanded, setExpanded] = useState(false);
  const { icon: Icon, className } = RUN_STATUS_ICONS[run.status];

  const hasError = !!run.errorMessage || !!run.errorCode;
  const hasOutput =
    run.output !== null && run.output !== undefined;

  return (
    <div>
      <button
        className="flex w-full items-center gap-2 rounded px-1 py-0.5 text-left hover:bg-accent/50 transition-colors"
        onClick={() => setExpanded((v) => !v)}
        type="button"
      >
        <Icon className={`size-3.5 shrink-0 ${className}`} />
        <span className="text-foreground text-sm capitalize">{run.status}</span>
        <span className="ml-auto text-muted-foreground text-xs capitalize">
          {run.trigger}
        </span>
        <span className="text-muted-foreground text-xs">
          {run.createdAt ? formatRelativeTimeToNow(run.createdAt) : "—"}
        </span>
      </button>

      {expanded && (
        <div className="mt-1 ml-5 rounded bg-muted/50 px-2 py-1.5 text-xs text-muted-foreground">
          {hasError ? (
            <div className="space-y-0.5">
              {run.errorCode && (
                <p>
                  <span className="font-medium">Code:</span> {run.errorCode}
                </p>
              )}
              {run.errorMessage && <p>{run.errorMessage}</p>}
            </div>
          ) : hasOutput ? (
            <pre className="whitespace-pre-wrap break-all">
              {JSON.stringify(run.output, null, 2)}
            </pre>
          ) : (
            <p>No output captured.</p>
          )}
        </div>
      )}
    </div>
  );
}

export function AutomationRunsList({
  automationId,
}: {
  automationId: string;
}) {
  const trpc = useTRPC();

  const { data: runs } = useSuspenseQuery({
    ...trpc.org.workspace.automations.listRuns.queryOptions({
      id: automationId,
      limit: 20,
    }),
    staleTime: 5_000,
    refetchOnWindowFocus: true,
  });

  return (
    <RailSection label="Previous runs">
      {runs.length === 0 ? (
        <p className="text-muted-foreground text-sm">No runs yet.</p>
      ) : (
        <div className="space-y-1">
          {runs.map((run) => (
            <RunRow key={run.publicId} run={run} />
          ))}
        </div>
      )}
    </RailSection>
  );
}
